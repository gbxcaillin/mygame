import { describe, expect, it } from "vitest";
import { placeCard, createInitialState, cardCounts } from "./engine";
import type { Card, GameState, RuleSet } from "./types";

const NO_SPECIAL_RULES: RuleSet = {
  open: true,
  same: false,
  plus: false,
  combo: false,
  sameWall: false,
};

function card(id: string, ranks: [number, number, number, number]): Card {
  const [top, bottom, left, right] = ranks;
  return { id, name: id, ranks: { top, bottom, left, right }, rarity: "Common", tier: 1 };
}

describe("basic capture rule", () => {
  it("captures an adjacent enemy card when the touching rank is strictly higher", () => {
    const bCard = card("b1", [1, 1, 1, 3]); // right = 3
    const aCard = card("a1", [1, 1, 5, 1]); // left = 5
    let state = createInitialState([aCard], [bCard], "B", NO_SPECIAL_RULES);
    state = placeCard(state, 0, bCard);
    state = placeCard(state, 1, aCard);

    expect(state.board[0]?.owner).toBe("A");
    expect(state.board[1]?.owner).toBe("A");
    expect(state.lastMove?.captured).toEqual([0]);
  });

  it("does not capture on a tie", () => {
    const bCard = card("b1", [1, 1, 1, 3]);
    const aCard = card("a1", [1, 1, 3, 1]); // left = 3, ties b's right
    let state = createInitialState([aCard], [bCard], "B", NO_SPECIAL_RULES);
    state = placeCard(state, 0, bCard);
    state = placeCard(state, 1, aCard);

    expect(state.board[0]?.owner).toBe("B");
    expect(state.lastMove?.captured).toEqual([]);
  });
});

function stateWithBoard(
  placed: Record<number, { card: Card; owner: "A" | "B" }>,
  toPlay: { card: Card; player: "A" | "B" },
  rules: RuleSet
): GameState {
  const board: GameState["board"] = Array(9).fill(null);
  for (const [idx, cell] of Object.entries(placed)) {
    board[Number(idx)] = cell;
  }
  return {
    board,
    hands: { A: [], B: [], [toPlay.player]: [toPlay.card] } as GameState["hands"],
    turn: toPlay.player,
    rules,
    winner: null,
    lastMove: null,
  };
}

describe("same rule", () => {
  const rules: RuleSet = { ...NO_SPECIAL_RULES, same: true };

  it("captures all matched enemy cards when 2+ touching sides are equal", () => {
    const b0 = card("b0", [1, 1, 1, 5]); // right = 5
    const b2 = card("b2", [1, 1, 5, 1]); // left = 5
    const a1 = card("a1", [9, 9, 5, 5]); // left = 5, right = 5

    const state = stateWithBoard(
      { 0: { card: b0, owner: "B" }, 2: { card: b2, owner: "B" } },
      { card: a1, player: "A" },
      rules
    );
    const result = placeCard(state, 1, a1);

    expect(result.board[0]?.owner).toBe("A");
    expect(result.board[2]?.owner).toBe("A");
    expect(result.lastMove?.trigger).toBe("same");
  });
});

describe("plus rule", () => {
  const rules: RuleSet = { ...NO_SPECIAL_RULES, plus: true };

  it("captures all matched enemy cards when 2+ pairs of touching sides share a sum", () => {
    // Center cell (4) neighbors: top=1, left=3
    const b1 = card("b1", [1, 2, 1, 1]); // bottom = 2 (faces center's top)
    const b3 = card("b3", [1, 1, 1, 4]); // right = 4 (faces center's left)
    // top pair: 6 + 2 = 8, left pair: 4 + 4 = 8 -> sums match, ranks don't (not a "same").
    const aCenter = card("ac", [6, 1, 4, 1]);

    const state = stateWithBoard(
      { 1: { card: b1, owner: "B" }, 3: { card: b3, owner: "B" } },
      { card: aCenter, player: "A" },
      rules
    );
    const result = placeCard(state, 4, aCenter);

    expect(result.board[1]?.owner).toBe("A");
    expect(result.board[3]?.owner).toBe("A");
    expect(result.lastMove?.trigger).toBe("plus");
  });
});

describe("combo rule", () => {
  it("chains basic captures from cards flipped by same", () => {
    const rules: RuleSet = {
      open: true,
      same: true,
      plus: false,
      combo: true,
      sameWall: false,
    };
    // b0 -- b1
    //  |     |
    // b3 -- (4:A)
    const b0 = card("b0", [1, 1, 1, 3]); // right = 3 (weak, falls to combo)
    const b1 = card("b1", [1, 2, 7, 1]); // bottom = 2 (matches center top), left = 7 (beats b0.right)
    const b3 = card("b3", [1, 1, 1, 2]); // right = 2 (matches center left)
    const aCenter = card("ac", [2, 1, 2, 1]); // top = 2, left = 2 -> two same matches

    const state = stateWithBoard(
      {
        0: { card: b0, owner: "B" },
        1: { card: b1, owner: "B" },
        3: { card: b3, owner: "B" },
      },
      { card: aCenter, player: "A" },
      rules
    );
    const result = placeCard(state, 4, aCenter);

    expect(result.board[1]?.owner).toBe("A"); // captured via same
    expect(result.board[3]?.owner).toBe("A"); // captured via same
    // combo: b1 (now A, at index 1) vs b0 (index 0) via b1.left(7) > b0.right(3)
    expect(result.board[0]?.owner).toBe("A");
  });
});

describe("win detection", () => {
  it("declares the player with more board cards the winner once the board fills", () => {
    const filler = (id: string) => card(id, [1, 1, 1, 1]);
    const owners: ("A" | "B")[] = ["A", "A", "A", "A", "A", "B", "B", "B"];
    const board: GameState["board"] = owners.map((owner, i) => ({
      card: filler(`f${i}`),
      owner,
    }));
    board.push(null);

    const lastCard = filler("last");
    const state: GameState = {
      board,
      hands: { A: [], B: [lastCard] },
      turn: "B",
      rules: NO_SPECIAL_RULES,
      winner: null,
      lastMove: null,
    };

    const result = placeCard(state, 8, lastCard);
    expect(result.winner).toBe("A");
  });
});

describe("cardCounts", () => {
  it("counts board cards plus remaining hand cards per player", () => {
    const a1 = card("a1", [1, 1, 1, 1]);
    const b1 = card("b1", [1, 1, 1, 1]);
    let state = createInitialState([a1], [b1], "A", NO_SPECIAL_RULES);
    state = placeCard(state, 0, a1);
    const counts = cardCounts(state);
    expect(counts.A).toBe(1);
    expect(counts.B).toBe(1);
  });
});
