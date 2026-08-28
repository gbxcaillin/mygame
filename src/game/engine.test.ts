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

const filler = (id: string) => card(id, [1, 1, 1, 1]); // never captures (1 > 1 is false)

/** Board with the 8 given owners in cells 0..7 and cell 8 left empty. */
function nearFullBoard(owners: ("A" | "B")[]): GameState["board"] {
  const board: GameState["board"] = owners.map((owner, i) => ({ card: filler(`f${i}`), owner }));
  board.push(null);
  return board;
}

describe("win detection (10-card scoring: board ownership + remaining hand cards)", () => {
  it("Player A wins 6-4 with a card still in B's hand", () => {
    // board fills to A:5 B:4; A also holds one unplayed card -> 6 vs 4
    const state: GameState = {
      board: nearFullBoard(["A", "A", "A", "A", "A", "B", "B", "B"]),
      hands: { A: [filler("aLeft")], B: [filler("last")] },
      turn: "B",
      rules: NO_SPECIAL_RULES,
      winner: null,
      lastMove: null,
    };
    const result = placeCard(state, 8, state.hands.B[0]);
    expect(result.winner).toBe("A");
    const counts = cardCounts(result);
    expect([counts.A, counts.B]).toEqual([6, 4]);
    expect(counts.A + counts.B).toBe(10);
  });

  it("Player B wins 6-4 with a card still in B's hand", () => {
    // board fills to A:4 B:5; B also holds one unplayed card -> 4 vs 6
    const state: GameState = {
      board: nearFullBoard(["A", "A", "A", "B", "B", "B", "B", "B"]),
      hands: { A: [filler("last")], B: [filler("bLeft")] },
      turn: "A",
      rules: NO_SPECIAL_RULES,
      winner: null,
      lastMove: null,
    };
    const result = placeCard(state, 8, state.hands.A[0]);
    expect(result.winner).toBe("B");
    const counts = cardCounts(result);
    expect([counts.A, counts.B]).toEqual([4, 6]);
    expect(counts.A + counts.B).toBe(10);
  });

  it("is a 5-5 draw when board ownership plus the leftover hand card tie", () => {
    // board fills to A:4 B:5; A holds one unplayed card -> 5 vs 5
    const state: GameState = {
      board: nearFullBoard(["A", "A", "A", "A", "B", "B", "B", "B"]),
      hands: { A: [filler("aLeft")], B: [filler("last")] },
      turn: "B",
      rules: NO_SPECIAL_RULES,
      winner: null,
      lastMove: null,
    };
    const result = placeCard(state, 8, state.hands.B[0]);
    expect(result.winner).toBe("draw");
    const counts = cardCounts(result);
    expect([counts.A, counts.B]).toEqual([5, 5]);
  });

  it("includes the remaining hand card: a board-only A lead becomes a draw", () => {
    // after the last placement the board alone is A:5 B:4 (board-only -> A wins),
    // but B's one unplayed card makes it 5-5 -> the hand card must be counted.
    const state: GameState = {
      board: nearFullBoard(["A", "A", "A", "A", "B", "B", "B", "B"]),
      hands: { A: [filler("last")], B: [filler("bLeft")] },
      turn: "A",
      rules: NO_SPECIAL_RULES,
      winner: null,
      lastMove: null,
    };
    const result = placeCard(state, 8, state.hands.A[0]);

    // board-only would give A the win (5 vs 4)...
    let boardA = 0;
    let boardB = 0;
    for (const cell of result.board) {
      if (cell?.owner === "A") boardA++;
      else if (cell?.owner === "B") boardB++;
    }
    expect([boardA, boardB]).toEqual([5, 4]);
    // ...but counting B's leftover card makes it a genuine draw.
    expect(result.winner).toBe("draw");
    expect([cardCounts(result).A, cardCounts(result).B]).toEqual([5, 5]);
  });

  it("before the final move the displayed totals still sum to 10", () => {
    // one empty cell remains; 8 on board, one card still in hand -> 5 vs 5, total 10
    const state: GameState = {
      board: nearFullBoard(["A", "A", "A", "A", "B", "B", "B", "B"]),
      hands: { A: [filler("aLeft")], B: [filler("last")] },
      turn: "B",
      rules: NO_SPECIAL_RULES,
      winner: null,
      lastMove: null,
    };
    const counts = cardCounts(state);
    expect(counts.A + counts.B).toBe(10);
    expect(state.winner).toBeNull();
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

  it("sums board ownership and hand cards to the correct per-player totals", () => {
    // A owns 3 on board + 1 in hand = 4; B owns 2 on board + 4 in hand = 6; total 10
    const board: GameState["board"] = [
      { card: filler("f0"), owner: "A" },
      { card: filler("f1"), owner: "A" },
      { card: filler("f2"), owner: "A" },
      { card: filler("f3"), owner: "B" },
      { card: filler("f4"), owner: "B" },
      null,
      null,
      null,
      null,
    ];
    const state: GameState = {
      board,
      hands: { A: [filler("ah0")], B: [filler("bh0"), filler("bh1"), filler("bh2"), filler("bh3")] },
      turn: "A",
      rules: NO_SPECIAL_RULES,
      winner: null,
      lastMove: null,
    };
    const counts = cardCounts(state);
    expect(counts.A).toBe(4);
    expect(counts.B).toBe(6);
    expect(counts.A + counts.B).toBe(10);
  });
});
