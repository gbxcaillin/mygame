// Player collection: owned cards, earned rewards and saved decks,
// persisted to localStorage on this device. (A later stage can move the
// same shapes behind the relay server for cross-device sync.)

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

export function loadCollection(): Collection {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Collection;
      if (parsed && typeof parsed.owned === "object") {
        cached = {
          owned: parsed.owned,
          decks: Array.isArray(parsed.decks) ? parsed.decks : [],
          activeDeckId: parsed.activeDeckId ?? null,
        };
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
    if (cached) localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    /* storage full/blocked — collection lives for the session only */
  }
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
  persist();
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
  persist();
  return deck;
}

export function deleteDeck(deckId: string) {
  const col = loadCollection();
  col.decks = col.decks.filter((d) => d.id !== deckId);
  if (col.activeDeckId === deckId) col.activeDeckId = col.decks[0]?.id ?? null;
  persist();
}

export function setActiveDeck(deckId: string) {
  const col = loadCollection();
  if (col.decks.some((d) => d.id === deckId)) {
    col.activeDeckId = deckId;
    persist();
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
