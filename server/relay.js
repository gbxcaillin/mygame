// Court of Beasts multiplayer relay.
//
// A deliberately dumb pipe: pairs two websockets into a room under a short
// code and forwards JSON frames between them. All game logic lives in the
// clients (both run the same engine and replay each other's moves), so this
// server holds no game state, no accounts and no database.
//
// Protocol (JSON messages):
//   client -> relay:  {type:"host"}                      create a room
//                     {type:"join", code}                join an existing room
//                     {type:"data", data}                forward to the peer
//   relay -> client:  {type:"hosted", code}              room created
//                     {type:"joined", code}              you are in (guest)
//                     {type:"peer-joined"}               guest arrived (host)
//                     {type:"data", data}                from the peer
//                     {type:"peer-left"}                 peer gone, room dead
//                     {type:"error", reason}             room-not-found | room-full | bad-message

import { WebSocketServer } from "ws";

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

const wss = new WebSocketServer({ port: PORT });

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

console.log(`Court of Beasts relay listening on :${PORT}`);
