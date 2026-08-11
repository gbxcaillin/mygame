import { describe, expect, it } from "vitest";
import { chooseAiMove } from "./ai";
import { createInitialState, placeCard } from "./engine";
import type { Card, GameState, RuleSet } from "./types";

const NO_SPECIAL_RULES: RuleSet = { open: true, same: false, plus: false, combo: false, sameWall: false };

function card(id: string, ranks: [number, number, number, number]): Card {
  const [top, bottom, left, right] = ranks;
  return { id, name: id, ranks: { top, bottom, left, right }, rarity: "Common", tier: 1 };
}

function isLegal(state: GameState, player: "A" | "B", move: { cellIndex: number; card: Card }): boolean {
  return state.board[move.cellIndex] === null && state.hands[player].some((c) => c.id === move.card.id);
}

describe("chooseAiMove", () => {
  it("prefers a move that captures when the search is enabled (difficulty 5)", () => {
    // Board: index 0 holds a weak A card (right=1). Empty cells: 1 (captures the
    // weak card via B's left=9) and 8 (an isolated corner, no capture).
    const weakA = card("weak-a", [1, 1, 1, 1]);
    const bCard = card("strong-b", [1, 1, 9, 1]);
    const board: GameState["board"] = Array(9).fill(null);
    board[0] = { card: weakA, owner: "A" };

    const state: GameState = {
      board,
      hands: { A: [], B: [bCard] },
      turn: "B",
      rules: NO_SPECIAL_RULES,
      winner: null,
      lastMove: null,
    };

    const move = chooseAiMove(state, "B", 5);
    expect(move.cellIndex).toBe(1);
  });

  it("always returns a legal move across difficulties and board states", () => {
    for (let trial = 0; trial < 20; trial++) {
      const { handA, handB } = randomHands();
      let state = createInitialState(handA, handB, "A", NO_SPECIAL_RULES);
      // Play a few random legal moves to reach a mid-game board.
      for (let i = 0; i < 3 && !state.winner; i++) {
        const player = state.turn;
        const moves = legalMovesFor(state, player);
        if (moves.length === 0) break;
        const pick = moves[Math.floor(Math.random() * moves.length)];
        state = placeCard(state, pick.cellIndex, pick.card);
      }
      if (state.winner) continue;
      for (const difficulty of [1, 2, 3, 4, 5] as const) {
        const move = chooseAiMove(state, state.turn, difficulty);
        expect(isLegal(state, state.turn, move)).toBe(true);
      }
    }
  });

  it("resolves within a reasonable time budget even at max difficulty from an empty board", () => {
    const { handA, handB } = randomHands();
    const state = createInitialState(handA, handB, "A", NO_SPECIAL_RULES);
    const start = performance.now();
    chooseAiMove(state, "A", 5);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });
});

function legalMovesFor(state: GameState, player: "A" | "B") {
  const moves: { cellIndex: number; card: Card }[] = [];
  for (const c of state.hands[player]) {
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i] === null) moves.push({ cellIndex: i, card: c });
    }
  }
  return moves;
}

function randomHands(): { handA: Card[]; handB: Card[] } {
  const pool = Array.from({ length: 10 }, (_, i) =>
    card(`c${i}`, [
      1 + Math.floor(Math.random() * 9),
      1 + Math.floor(Math.random() * 9),
      1 + Math.floor(Math.random() * 9),
      1 + Math.floor(Math.random() * 9),
    ])
  );
  return { handA: pool.slice(0, 5), handB: pool.slice(5, 10) };
}
