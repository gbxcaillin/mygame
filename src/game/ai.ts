import { placeCard } from "./engine";
import type { Card, GameState, PlayerId } from "./types";

/** 1 = weakest (random), 5 = strongest. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "Beginner",
  2: "Easy",
  3: "Medium",
  4: "Hard",
  5: "Expert",
};

export interface Move {
  cellIndex: number;
  card: Card;
}

// Extra plies searched beyond the AI's own candidate move (0 = pure greedy,
// ignoring the opponent's reply entirely). Kept modest so the search stays
// well under a video-frame budget even from an empty board with alpha-beta
// pruning and move ordering doing most of the work.
const DEPTH_BY_DIFFICULTY: Record<Difficulty, number> = { 1: 0, 2: 0, 3: 1, 4: 2, 5: 3 };

// Chance of ignoring the search result and playing a random legal move
// instead, so weaker difficulties feel fallible rather than merely shallow.
const BLUNDER_RATE_BY_DIFFICULTY: Record<Difficulty, number> = { 1: 1, 2: 0.35, 3: 0.15, 4: 0.05, 5: 0 };

function legalMoves(state: GameState, player: PlayerId): Move[] {
  const moves: Move[] = [];
  for (const card of state.hands[player]) {
    for (let cellIndex = 0; cellIndex < state.board.length; cellIndex++) {
      if (state.board[cellIndex] === null) moves.push({ cellIndex, card });
    }
  }
  return moves;
}

/** Board + hand card-count differential from `forPlayer`'s perspective. */
function evaluate(state: GameState, forPlayer: PlayerId): number {
  const other: PlayerId = forPlayer === "A" ? "B" : "A";
  let mine = state.hands[forPlayer].length;
  let theirs = state.hands[other].length;
  for (const cell of state.board) {
    if (cell?.owner === forPlayer) mine++;
    else if (cell?.owner === other) theirs++;
  }
  return mine - theirs;
}

function minimax(
  state: GameState,
  depth: number,
  maximizingPlayer: PlayerId,
  alpha: number,
  beta: number
): number {
  if (state.winner || depth === 0) return evaluate(state, maximizingPlayer);

  const mover = state.turn;
  const moves = legalMoves(state, mover);
  if (moves.length === 0) return evaluate(state, maximizingPlayer);

  const isMaximizing = mover === maximizingPlayer;
  // Cheap move ordering (evaluate one ply ahead only) so alpha-beta prunes
  // far more of the tree than an unordered search would.
  const ordered = moves
    .map((move) => ({ move, next: placeCard(state, move.cellIndex, move.card) }))
    .sort((a, b) => {
      const diff = evaluate(a.next, maximizingPlayer) - evaluate(b.next, maximizingPlayer);
      return isMaximizing ? -diff : diff;
    });

  let best = isMaximizing ? -Infinity : Infinity;
  for (const { next } of ordered) {
    const val = minimax(next, depth - 1, maximizingPlayer, alpha, beta);
    if (isMaximizing) {
      best = Math.max(best, val);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, val);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/** Picks a move for `player` at the given difficulty. Throws if no legal move exists. */
export function chooseAiMove(state: GameState, player: PlayerId, difficulty: Difficulty): Move {
  const moves = legalMoves(state, player);
  if (moves.length === 0) throw new Error("chooseAiMove: no legal moves available");

  if (Math.random() < BLUNDER_RATE_BY_DIFFICULTY[difficulty]) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = DEPTH_BY_DIFFICULTY[difficulty];
  let bestMoves: Move[] = [];
  let bestVal = -Infinity;
  for (const move of moves) {
    const next = placeCard(state, move.cellIndex, move.card);
    const val = minimax(next, depth, player, -Infinity, Infinity);
    if (val > bestVal) {
      bestVal = val;
      bestMoves = [move];
    } else if (val === bestVal) {
      bestMoves.push(move);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
