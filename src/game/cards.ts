import type { Card } from "./types";

// A small starter card pool, roughly balanced by total rank power.
export const CARD_POOL: Card[] = [
  { id: "geezard", name: "Geezard", ranks: { top: 1, bottom: 5, left: 5, right: 1 } },
  { id: "funguar", name: "Funguar", ranks: { top: 2, bottom: 1, left: 5, right: 5 } },
  { id: "bite-bug", name: "Bite Bug", ranks: { top: 6, bottom: 1, left: 1, right: 4 } },
  { id: "red-bat", name: "Red Bat", ranks: { top: 5, bottom: 2, left: 1, right: 4 } },
  { id: "blobra", name: "Blobra", ranks: { top: 2, bottom: 3, left: 5, right: 5 } },
  { id: "gayla", name: "Gayla", ranks: { top: 5, bottom: 5, left: 2, right: 4 } },
  { id: "gesper", name: "Gesper", ranks: { top: 4, bottom: 6, left: 2, right: 3 } },
  { id: "fastitocalon-f", name: "Fastitocalon-F", ranks: { top: 5, bottom: 3, left: 5, right: 2 } },
  { id: "blood-soul", name: "Blood Soul", ranks: { top: 3, bottom: 3, left: 1, right: 1 } },
  { id: "caterchipillar", name: "Caterchipillar", ranks: { top: 8, bottom: 5, left: 2, right: 1 } },
  { id: "cockatrice", name: "Cockatrice", ranks: { top: 5, bottom: 3, left: 4, right: 6 } },
  { id: "grat", name: "Grat", ranks: { top: 3, bottom: 4, left: 6, right: 5 } },
  { id: "buel", name: "Buel", ranks: { top: 6, bottom: 3, left: 5, right: 4 } },
  { id: "mesmerize", name: "Mesmerize", ranks: { top: 7, bottom: 4, left: 4, right: 6 } },
  { id: "glacial-eye", name: "Glacial Eye", ranks: { top: 5, bottom: 6, left: 6, right: 5 } },
  { id: "belhelmel", name: "Belhelmel", ranks: { top: 5, bottom: 6, left: 6, right: 4 } },
  { id: "thrustaevis", name: "Thrustaevis", ranks: { top: 5, bottom: 6, left: 7, right: 4 } },
  { id: "anacondaur", name: "Anacondaur", ranks: { top: 6, bottom: 3, left: 5, right: 7 } },
  { id: "creeps", name: "Creeps", ranks: { top: 5, bottom: 5, left: 6, right: 6 } },
  { id: "abyss-worm", name: "Abyss Worm", ranks: { top: 8, bottom: 3, left: 5, right: 4 } },
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Deals two disjoint 5-card hands from the pool, cloning each card so board/hand instances are independent. */
export function dealHands(): { handA: Card[]; handB: Card[] } {
  const shuffled = shuffle(CARD_POOL);
  const clone = (c: Card): Card => ({ ...c, ranks: { ...c.ranks } });
  return {
    handA: shuffled.slice(0, 5).map(clone),
    handB: shuffled.slice(5, 10).map(clone),
  };
}
