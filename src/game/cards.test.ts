import { describe, expect, it } from "vitest";
import { CARD_POOL, dealHands, dealDraftPool, dealHandExcluding } from "./cards";

describe("pyramid-weighted dealing", () => {
  it("deals two disjoint hands of 5 distinct cards", () => {
    for (let i = 0; i < 50; i++) {
      const { handA, handB } = dealHands();
      expect(handA).toHaveLength(5);
      expect(handB).toHaveLength(5);
      const ids = new Set([...handA, ...handB].map((c) => c.id));
      expect(ids.size).toBe(10);
    }
  });

  it("draft pool is 10 distinct cards", () => {
    for (let i = 0; i < 50; i++) {
      const pool = dealDraftPool(10);
      expect(new Set(pool.map((c) => c.id)).size).toBe(10);
    }
  });

  it("excludes the given ids", () => {
    const exclude = new Set(CARD_POOL.slice(0, 5).map((c) => c.id));
    for (let i = 0; i < 50; i++) {
      const hand = dealHandExcluding(exclude);
      expect(hand).toHaveLength(5);
      for (const c of hand) expect(exclude.has(c.id)).toBe(false);
    }
  });

  it("low tiers appear far more often than high tiers", () => {
    const tierCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const deals = 2000;
    for (let i = 0; i < deals; i++) {
      const { handA, handB } = dealHands();
      for (const c of [...handA, ...handB]) tierCounts[c.tier]++;
    }
    // Strict pyramid: each tier strictly rarer than the one below it,
    // with generous slack so the test never flakes.
    expect(tierCounts[1]).toBeGreaterThan(tierCounts[3]);
    expect(tierCounts[2]).toBeGreaterThan(tierCounts[4]);
    expect(tierCounts[3]).toBeGreaterThan(tierCounts[5]);
    expect(tierCounts[4]).toBeGreaterThan(tierCounts[6]);
    // Commons should be several times more frequent than Mythics.
    expect(tierCounts[1]).toBeGreaterThan(tierCounts[6] * 4);
  });
});
