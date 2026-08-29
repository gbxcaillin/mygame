// Friend Bot — connects to the relay as the GUEST of a hosted match and plays
// with the real game AI, so you can test the online friend flow (collection
// draft, wager, dice, card transfer) solo. It speaks the same relay + game
// protocol as src/net.ts and src/App.tsx.

import { createInitialState, placeCard } from "../src/game/engine";
import { chooseAiMove } from "../src/game/ai";
import type { Difficulty } from "../src/game/ai";
import type { Card, GameState, PlayerId, RuleSet } from "../src/game/types";
import { CARD_POOL } from "./creatures";

type NetData =
  | { t: "hand"; cards: string[]; wager: boolean }
  | { t: "setup"; a: string[]; b: string[]; starter: PlayerId; rules: RuleSet; wager: boolean }
  | { t: "flip" }
  | { t: "move"; cell: number; cardId: string }
  | { t: "ante"; roll: number; cardId: string; picks: string[] }
  | { t: "rematch" };

const byId = new Map(CARD_POOL.map((c) => [c.id, c]));
const clone = (c: Card): Card => ({ ...c, ranks: { ...c.ranks } });
const cardsFromIds = (ids: string[]): Card[] =>
  ids.flatMap((id) => {
    const c = byId.get(id);
    return c ? [clone(c)] : [];
  });

// ── DOM ──
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const logEl = $("log");
function log(msg: string, cls = "") {
  const line = document.createElement("div");
  line.className = "line " + cls;
  const t = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="t">${t}</span> ${msg}`;
  logEl.prepend(line);
}

// ── bot state ──
let ws: WebSocket | null = null;
let state: GameState | null = null;
let fielded: Card[] = []; // the 5 the bot brought
let discarded: Card[] = []; // the 5 it drafted but benched
let wagered = false;
let committed = false; // true once the coin flip has resolved on the host
let difficulty: Difficulty = 3;
let wagerPref = true;

const THINK_MS = 1100;
const COMMIT_WAIT_MS = 2900; // host commits the match ~2.5s after the coin flip

function send(data: NetData) {
  ws?.send(JSON.stringify({ type: "data", data }));
}

function draftAndSend() {
  const shuffled = [...CARD_POOL].sort(() => Math.random() - 0.5).slice(0, 10);
  // pick the 5 strongest by rank-sum so the bot fields a decent hand
  const ranked = [...shuffled].sort(
    (a, b) => sum(b.ranks) - sum(a.ranks)
  );
  fielded = ranked.slice(0, 5).map(clone);
  discarded = ranked.slice(5).map(clone);
  send({ t: "hand", cards: fielded.map((c) => c.id), wager: wagerPref });
  log(`Drafted & sent hand: ${fielded.map((c) => c.name).join(", ")} — wager ${wagerPref ? "ON" : "off"}`, "me");
}
const sum = (r: { top: number; bottom: number; left: number; right: number }) =>
  r.top + r.bottom + r.left + r.right;

function botMove() {
  if (!state || state.winner || state.turn !== "B" || !committed) return;
  const move = chooseAiMove(state, "B", difficulty);
  state = placeCard(state, move.cellIndex, move.card);
  send({ t: "move", cell: move.cellIndex, cardId: move.card.id });
  log(`Bot plays ${move.card.name} → cell ${move.cellIndex + 1}`, "me");
  checkEnd();
}

function checkEnd() {
  if (!state?.winner) return;
  const w = state.winner;
  log(`Match over — winner: ${w === "B" ? "Bot" : w === "A" ? "You" : "Draw"}`, "end");
  if (wagered && w !== "draw" && w !== "B") {
    // bot lost -> forfeit a card to you
    const roll = 1 + Math.floor(Math.random() * 6);
    const lost = roll <= 5 ? fielded[roll - 1] : discarded[Math.floor(Math.random() * discarded.length)];
    if (lost) {
      send({ t: "ante", roll, cardId: lost.id, picks: fielded.map((c) => c.id) });
      log(`Wager: rolled ${roll} — bot forfeits ${lost.name} to you`, "end");
    }
  }
}

function handle(data: NetData) {
  if (data.t === "setup") {
    const handA = cardsFromIds(data.a);
    const handB = cardsFromIds(data.b);
    if (handA.length !== 5 || handB.length !== 5) return;
    fielded = handB.map(clone); // authoritative: what the host says the bot fielded
    wagered = data.wager;
    committed = false;
    state = createInitialState(handA, handB, data.starter, data.rules);
    log(`Match set. ${data.starter === "A" ? "You" : "Bot"} go first. Wager ${wagered ? "ON" : "off"}. Waiting for the coin…`, "sys");
  } else if (data.t === "flip") {
    log("You flipped the coin…", "sys");
    window.setTimeout(() => {
      committed = true;
      botMove(); // if the bot starts, move now that the host has committed
    }, COMMIT_WAIT_MS);
  } else if (data.t === "move") {
    if (!state || state.winner) return;
    const card = state.hands[state.turn].find((c) => c.id === data.cardId);
    if (!card || state.board[data.cell] !== null) return;
    state = placeCard(state, data.cell, card);
    log(`You play ${card.name} → cell ${data.cell + 1}`, "you");
    checkEnd();
    if (state && !state.winner && state.turn === "B") window.setTimeout(botMove, THINK_MS);
  } else if (data.t === "ante") {
    const c = byId.get(data.cardId);
    log(`Wager: you rolled ${data.roll} — you forfeit ${c?.name ?? data.cardId} to the bot`, "end");
  } else if (data.t === "rematch") {
    state = null;
    committed = false;
    log("You started a new game — redrafting…", "sys");
    draftAndSend();
  }
}

function connect(relay: string, code: string) {
  ws?.close();
  state = null;
  committed = false;
  log(`Connecting to ${relay}…`, "sys");
  ws = new WebSocket(relay);
  ws.onopen = () => {
    log("Connected. Joining room " + code + "…", "sys");
    ws?.send(JSON.stringify({ type: "join", code }));
  };
  ws.onmessage = (e) => {
    let msg: { type?: string; data?: NetData; reason?: string };
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.type === "joined") {
      log("Joined the room. Drafting a hand…", "sys");
      setStatus("connected", "In the room — draft a hand on your side and pick 5.");
      draftAndSend();
    } else if (msg.type === "data" && msg.data) {
      handle(msg.data);
    } else if (msg.type === "peer-left") {
      log("Host left the room.", "sys");
      setStatus("idle", "Host disconnected.");
    } else if (msg.type === "error") {
      const reason =
        msg.reason === "room-not-found"
          ? "No game with that code — host first, then enter the code here."
          : msg.reason === "room-full"
            ? "That room already has two players."
            : "Connection error.";
      log("Error: " + reason, "end");
      setStatus("idle", reason);
    }
  };
  ws.onclose = () => log("Socket closed.", "sys");
  ws.onerror = () => log("Socket error (can't reach the relay).", "end");
}

function setStatus(kind: string, text: string) {
  const s = $("status");
  s.className = "status " + kind;
  s.textContent = text;
}

// ── wire the UI ──
(function init() {
  const params = new URLSearchParams(location.search);
  ($("relay") as HTMLInputElement).value = params.get("relay") || "wss://play.gbxps.com";
  ($("code") as HTMLInputElement).addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  });
  ($("difficulty") as HTMLSelectElement).addEventListener("change", (e) => {
    difficulty = Number((e.target as HTMLSelectElement).value) as Difficulty;
  });
  ($("wager") as HTMLInputElement).addEventListener("change", (e) => {
    wagerPref = (e.target as HTMLInputElement).checked;
  });
  $("connect").addEventListener("click", () => {
    const relay = ($("relay") as HTMLInputElement).value.trim();
    const code = ($("code") as HTMLInputElement).value.trim();
    if (code.length !== 4) {
      setStatus("idle", "Enter the 4-letter room code the game gave you.");
      return;
    }
    setStatus("connecting", "Connecting…");
    connect(relay, code);
  });
})();
