// Player collection: owned cards, earned rewards and saved decks.
//
// The server (server/store.js) is the primary store when a name is claimed;
// this module keeps a synchronous localStorage cache so the UI stays simple
// and the installed app still works offline. sync.ts hydrates this cache
// from the server on launch and pushes every change back up (it listens via
// subscribe()).

import { CARD_POOL } from "./cards";
import type { Card } from "./types";
import type { Difficulty } from "./ai";

const STORAGE_KEY = "cob-collection";

export interface SavedDeck {
  id: string;
  name: string;
  cardIds: string[]; // exactly 5
}

export interface Collection {
  /** cardId -> copies owned (>= 1) */
  owned: Record<string, number>;
  decks: SavedDeck[];
  /** id of the deck used by the "My Deck" option, if any */
  activeDeckId: string | null;
}

/** Every tier-1 creature plus a taste of tier 2 — enough to build a first deck. */
const STARTER_IDS = [
  ...CARD_POOL.filter((c) => c.tier === 1).map((c) => c.id),
  "orc",
  "ghoul",
  "harpy",
  "dryad",
  "satyr",
];

function starterCollection(): Collection {
  const owned: Record<string, number> = {};
  for (const id of STARTER_IDS) owned[id] = 1;
  return { owned, decks: [], activeDeckId: null };
}

let cached: Collection | null = null;
let currentName: string | null = null;
const listeners = new Set<() => void>();

/** Local cache key — namespaced per claimed name; the bare key is the
    pre-claim "guest" collection (and back-compat with older saves). */
function keyFor(name: string | null): string {
  return name ? `${STORAGE_KEY}:${name}` : STORAGE_KEY;
}

/** Subscribe to any collection change (mutation or server hydrate). */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  for (const fn of listeners) fn();
}

function normalize(parsed: Partial<Collection> | null): Collection {
  return {
    owned: parsed && typeof parsed.owned === "object" ? parsed.owned : {},
    decks: parsed && Array.isArray(parsed.decks) ? parsed.decks : [],
    activeDeckId: parsed?.activeDeckId ?? null,
  };
}

export function loadCollection(): Collection {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(keyFor(currentName));
    if (raw) {
      const parsed = JSON.parse(raw) as Collection;
      if (parsed && typeof parsed.owned === "object") {
        cached = normalize(parsed);
        return cached;
      }
    }
  } catch {
    /* fall through to a fresh start */
  }
  cached = starterCollection();
  persist();
  return cached;
}

function persist() {
  try {
    if (cached) localStorage.setItem(keyFor(currentName), JSON.stringify(cached));
  } catch {
    /* storage full/blocked — collection lives for the session only */
  }
}

/** Persist locally AND notify subscribers (which triggers the server push). */
function afterMutate() {
  persist();
  emit();
}

export function getName(): string | null {
  return currentName;
}

/** Switch the active collection to a named (or guest, null) local slot. */
export function switchName(name: string | null) {
  if (name === currentName) return;
  currentName = name;
  cached = null;
  loadCollection();
  emit();
}

/** Replace the whole collection (e.g. hydrated from the server). */
export function hydrate(data: Partial<Collection>) {
  cached = normalize(data);
  persist();
  emit();
}

/** Test hook / hard reset. */
export function resetCollection(): Collection {
  cached = starterCollection();
  persist();
  return cached;
}

export function ownedCount(cardId: string): number {
  return loadCollection().owned[cardId] ?? 0;
}

export function totalOwnedDistinct(): number {
  return Object.keys(loadCollection().owned).length;
}

/* ── earning ──────────────────────────────────────────────────────────
   Drop odds follow the rarity pyramid, but harder difficulties shift
   weight toward the high tiers. Weight per tier = base ** (per-tier
   exponent shrinking with difficulty); numbers tuned so Beginner almost
   always pays commons while Expert pays Epic+ roughly half the time. */

const DROP_WEIGHTS: Record<Difficulty, number[]> = {
  // index 0 = tier 1 … index 5 = tier 6
  1: [50, 28, 14, 6, 1.6, 0.4],
  2: [38, 28, 18, 10, 4.5, 1.5],
  3: [24, 24, 21, 10, 12, 4],
  4: [12, 18, 22, 24, 16, 8],
  5: [6, 12, 18, 26, 24, 14],
};

export function rollReward(difficulty: Difficulty, rng: () => number = Math.random): Card {
  const weights = DROP_WEIGHTS[difficulty];
  const total = CARD_POOL.reduce((sum, c) => sum + weights[c.tier - 1], 0);
  let r = rng() * total;
  for (const card of CARD_POOL) {
    r -= weights[card.tier - 1];
    if (r <= 0) return card;
  }
  return CARD_POOL[CARD_POOL.length - 1];
}

/** Roll a reward for beating the computer and add it to the collection. */
export function earnReward(difficulty: Difficulty): { card: Card; isNew: boolean } {
  const card = rollReward(difficulty);
  const col = loadCollection();
  const isNew = !(card.id in col.owned);
  col.owned[card.id] = (col.owned[card.id] ?? 0) + 1;
  afterMutate();
  return { card, isNew };
}

/* ── decks ── */

export function saveDeck(name: string, cardIds: string[]): SavedDeck | null {
  if (cardIds.length !== 5) return null;
  const col = loadCollection();
  if (!cardIds.every((id) => (col.owned[id] ?? 0) > 0)) return null;
  const deck: SavedDeck = {
    id: `deck-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: name.trim() || "My Deck",
    cardIds: [...cardIds],
  };
  col.decks.push(deck);
  col.activeDeckId = deck.id;
  afterMutate();
  return deck;
}

export function deleteDeck(deckId: string) {
  const col = loadCollection();
  col.decks = col.decks.filter((d) => d.id !== deckId);
  if (col.activeDeckId === deckId) col.activeDeckId = col.decks[0]?.id ?? null;
  afterMutate();
}

export function setActiveDeck(deckId: string) {
  const col = loadCollection();
  if (col.decks.some((d) => d.id === deckId)) {
    col.activeDeckId = deckId;
    afterMutate();
  }
}

/** The active deck's cards, or null if none is set/valid. */
export function activeDeckCards(): Card[] | null {
  const col = loadCollection();
  const deck = col.decks.find((d) => d.id === col.activeDeckId);
  if (!deck) return null;
  const byId = new Map(CARD_POOL.map((c) => [c.id, c]));
  const cards = deck.cardIds.flatMap((id) => {
    const c = byId.get(id);
    return c ? [c] : [];
  });
  return cards.length === 5 ? cards : null;
}
