import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  activeDeckCards,
  earnReward,
  getName,
  hydrate,
  loadCollection,
  ownedCount,
  resetCollection,
  rollReward,
  saveDeck,
  setActiveDeck,
  switchName,
  deleteDeck,
} from "./collection";
import { CARD_POOL } from "./cards";

// The test runner is node (no DOM); give collection.ts a real localStorage so
// per-name persistence can be exercised.
beforeAll(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
});

beforeEach(() => {
  switchName(null);
  localStorage.clear();
  resetCollection();
});

describe("collection", () => {
  it("starter set owns all tier-1 creatures plus some tier-2", () => {
    const col = loadCollection();
    const tier1 = CARD_POOL.filter((c) => c.tier === 1);
    for (const c of tier1) expect(col.owned[c.id]).toBe(1);
    expect(Object.keys(col.owned).length).toBe(15);
  });

  it("earning adds copies and flags new cards", () => {
    const before = Object.keys(loadCollection().owned).length;
    let sawNew = false;
    for (let i = 0; i < 200; i++) {
      const { card, isNew } = earnReward(5);
      expect(ownedCount(card.id)).toBeGreaterThan(0);
      if (isNew) sawNew = true;
    }
    expect(sawNew).toBe(true);
    expect(Object.keys(loadCollection().owned).length).toBeGreaterThan(before);
  });

  it("harder difficulties pay higher tiers on average", () => {
    const avgTier = (d: 1 | 5) => {
      let sum = 0;
      for (let i = 0; i < 3000; i++) sum += rollReward(d).tier;
      return sum / 3000;
    };
    expect(avgTier(5)).toBeGreaterThan(avgTier(1) + 1);
  });

  it("saves, activates and deletes decks of owned cards only", () => {
    const owned = Object.keys(loadCollection().owned).slice(0, 5);
    const deck = saveDeck("Test", owned)!;
    expect(deck).not.toBeNull();
    expect(activeDeckCards()?.map((c) => c.id)).toEqual(owned);

    // a deck containing an unowned card is rejected
    const unowned = CARD_POOL.find((c) => !(c.id in loadCollection().owned))!;
    expect(saveDeck("Bad", [...owned.slice(0, 4), unowned.id])).toBeNull();

    const deck2 = saveDeck("Second", owned)!;
    setActiveDeck(deck.id);
    expect(loadCollection().activeDeckId).toBe(deck.id);
    deleteDeck(deck.id);
    expect(loadCollection().activeDeckId).toBe(deck2.id);
    deleteDeck(deck2.id);
    expect(activeDeckCards()).toBeNull();
  });

  it("keeps separate collections per name and hydrates from a server payload", () => {
    // guest earns some cards
    earnReward(5);
    const guestCount = Object.keys(loadCollection().owned).length;

    // switching to a named slot starts fresh (its own local key)
    switchName("alice");
    expect(getName()).toBe("alice");
    expect(Object.keys(loadCollection().owned).length).toBe(15);

    // hydrate replaces the whole collection (as a server pull would)
    hydrate({ owned: { dragon: 3 }, decks: [], activeDeckId: null });
    expect(ownedCount("dragon")).toBe(3);
    expect(Object.keys(loadCollection().owned).length).toBe(1);

    // switching back to guest restores its independent data
    switchName(null);
    expect(Object.keys(loadCollection().owned).length).toBe(guestCount);
  });
});
