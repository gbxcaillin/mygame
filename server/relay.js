// Court of Beasts relay + collection API.
//
// Two jobs on one port:
//   1. WebSocket match relay — a dumb pipe pairing two sockets into a room
//      under a short code and forwarding JSON frames. All game logic lives
//      in the clients, so the relay holds no match state.
//   2. HTTP collection store — server-primary player collections keyed by a
//      claimed name (no auth, friends-and-family trust), in SQLite.
//
// Relay protocol (JSON over the websocket):
//   client -> relay:  {type:"host"} | {type:"join", code} | {type:"data", data}
//   relay -> client:  {type:"hosted"|"joined", code} | {type:"peer-joined"}
//                     | {type:"data", data} | {type:"peer-left"}
//                     | {type:"error", reason}
//
// Collection API (HTTP):
//   GET  /health                 -> "ok"
//   GET  /collection/:name       -> {data, updatedAt} | 404
//   PUT  /collection/:name       body {data} -> {updatedAt}

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { getCollection, putCollection, isValidName } from "./store.js";

const PORT = Number(process.env.PORT || 8787);
// no ambiguous characters (0/O, 1/I)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 4;

const rooms = new Map(); // code -> { host: ws, guest: ws | null }

function newCode() {
  for (;;) {
    let code = "";
    for (let i = 0; i < CODE_LEN; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function leaveRoom(ws) {
  const code = ws.room;
  if (!code) return;
  const room = rooms.get(code);
  ws.room = null;
  if (!room) return;
  const peer = room.host === ws ? room.guest : room.host;
  rooms.delete(code); // a broken pair is a dead game either way
  if (peer) {
    peer.room = null;
    send(peer, { type: "peer-left" });
  }
}

// ── HTTP: collection store ──

const CORS = {
  "Access-Control-Allow-Origin": "*", // no cookies/auth, so * is safe
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) reject(new Error("too-large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const httpServer = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, CORS);
    return res.end("ok");
  }

  const m = url.pathname.match(/^\/collection\/(.+)$/);
  if (m) {
    const name = decodeURIComponent(m[1]);
    if (!isValidName(name)) return json(res, 400, { error: "bad-name" });

    if (req.method === "GET") {
      const found = getCollection(name);
      if (!found) return json(res, 404, { error: "not-found" });
      return json(res, 200, found);
    }
    if (req.method === "PUT") {
      try {
        const body = JSON.parse(await readBody(req));
        if (!body || typeof body.data !== "object") return json(res, 400, { error: "bad-body" });
        const updatedAt = putCollection(name, body.data);
        return json(res, 200, { updatedAt });
      } catch {
        return json(res, 400, { error: "bad-request" });
      }
    }
  }

  json(res, 404, { error: "not-found" });
});

// ── WebSocket relay shares the same HTTP server (and port) ──

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { type: "error", reason: "bad-message" });
    }

    if (msg.type === "host") {
      leaveRoom(ws);
      const code = newCode();
      rooms.set(code, { host: ws, guest: null });
      ws.room = code;
      send(ws, { type: "hosted", code });
    } else if (msg.type === "join") {
      const code = String(msg.code || "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) return send(ws, { type: "error", reason: "room-not-found" });
      if (room.guest) return send(ws, { type: "error", reason: "room-full" });
      leaveRoom(ws);
      room.guest = ws;
      ws.room = code;
      send(ws, { type: "joined", code });
      send(room.host, { type: "peer-joined" });
    } else if (msg.type === "data") {
      const room = rooms.get(ws.room);
      if (!room) return;
      const peer = room.host === ws ? room.guest : room.host;
      send(peer, { type: "data", data: msg.data });
    }
  });

  ws.on("close", () => leaveRoom(ws));
  ws.on("error", () => leaveRoom(ws));
});

// drop dead connections so their rooms free up
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

httpServer.listen(PORT, () => {
  console.log(`Court of Beasts relay + collection API listening on :${PORT}`);
});
