import type { Card, Cell, GameState, PlayerId, RuleSet, Side } from "./types";
import { otherPlayer } from "./types";

const SIDES: Side[] = ["top", "bottom", "left", "right"];

const OPPOSITE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

const BOARD_SIZE = 9;
const COLS = 3;

/** Returns the neighbor cell index in `side` direction from `index`, or null if off the board. */
export function neighborIndex(index: number, side: Side): number | null {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  switch (side) {
    case "top":
      return row > 0 ? index - COLS : null;
    case "bottom":
      return row < COLS - 1 ? index + COLS : null;
    case "left":
      return col > 0 ? index - 1 : null;
    case "right":
      return col < COLS - 1 ? index + 1 : null;
  }
}

export function createInitialState(
  handA: Card[],
  handB: Card[],
  startingPlayer: PlayerId = "A",
  rules: RuleSet
): GameState {
  return {
    board: Array<Cell>(BOARD_SIZE).fill(null),
    hands: { A: [...handA], B: [...handB] },
    turn: startingPlayer,
    rules,
    winner: null,
    lastMove: null,
  };
}

export class IllegalMoveError extends Error {}

/**
 * Plays `card` from the current player's hand onto `cellIndex`, resolving
 * captures per the active rule set, and returns a new GameState.
 */
export function placeCard(
  state: GameState,
  cellIndex: number,
  card: Card
): GameState {
  if (state.winner) {
    throw new IllegalMoveError("Game is already over.");
  }
  if (cellIndex < 0 || cellIndex >= BOARD_SIZE) {
    throw new IllegalMoveError("Cell index out of range.");
  }
  if (state.board[cellIndex] !== null) {
    throw new IllegalMoveError("Cell is already occupied.");
  }
  const player = state.turn;
  const hand = state.hands[player];
  const handIdx = hand.findIndex((c) => c.id === card.id);
  if (handIdx === -1) {
    throw new IllegalMoveError("Card is not in the current player's hand.");
  }

  const board = [...state.board];
  board[cellIndex] = { card, owner: player };

  const captured = resolveCaptures(board, cellIndex, player, state.rules);
  for (const idx of captured.indices) {
    const cell = board[idx];
    if (cell) board[idx] = { ...cell, owner: player };
  }

  const hands = {
    ...state.hands,
    [player]: [...hand.slice(0, handIdx), ...hand.slice(handIdx + 1)],
  };

  const boardFull = board.every((c) => c !== null);
  const winner = boardFull ? determineWinner(board) : null;

  return {
    ...state,
    board,
    hands,
    turn: otherPlayer(player),
    winner,
    lastMove: {
      cellIndex,
      captured: captured.indices,
      trigger: captured.trigger,
    },
  };
}

interface CaptureResult {
  indices: number[];
  trigger: "basic" | "same" | "plus" | null;
}

function resolveCaptures(
  board: Cell[],
  placedIndex: number,
  player: PlayerId,
  rules: RuleSet
): CaptureResult {
  const placed = board[placedIndex];
  if (!placed) return { indices: [], trigger: null };

  const neighbors = SIDES.map((side) => {
    const idx = neighborIndex(placedIndex, side);
    return { side, idx, cell: idx === null ? null : board[idx] };
  });

  let special: number[] = [];
  let trigger: "same" | "plus" | null = null;

  if (rules.same) {
    const matchSides = neighbors.filter(({ side, cell, idx }) => {
      if (idx === null) {
        return rules.sameWall && placed.card.ranks[side] === 10;
      }
      if (!cell) return false;
      return placed.card.ranks[side] === cell.card.ranks[OPPOSITE[side]];
    });
    if (matchSides.length >= 2) {
      trigger = "same";
      special = matchSides
        .filter((m) => m.idx !== null && m.cell && m.cell.owner !== player)
        .map((m) => m.idx as number);
    }
  }

  if (rules.plus && trigger === null) {
    const present = neighbors.filter((n) => n.idx !== null && n.cell) as {
      side: Side;
      idx: number;
      cell: NonNullable<Cell>;
    }[];
    const sums = present.map((n) => ({
      ...n,
      sum: placed.card.ranks[n.side] + n.cell.card.ranks[OPPOSITE[n.side]],
    }));
    const plusIdx = new Set<number>();
    for (let i = 0; i < sums.length; i++) {
      for (let j = i + 1; j < sums.length; j++) {
        if (sums[i].sum === sums[j].sum) {
          if (sums[i].cell.owner !== player) plusIdx.add(sums[i].idx);
          if (sums[j].cell.owner !== player) plusIdx.add(sums[j].idx);
        }
      }
    }
    if (plusIdx.size > 0) {
      trigger = "plus";
      special = [...plusIdx];
    }
  }

  const capturedSet = new Set<number>(special);

  if (special.length > 0 && rules.combo) {
    const queue = [...special];
    while (queue.length > 0) {
      const comboIdx = queue.shift() as number;
      const comboBasic = basicCaptures(board, comboIdx, player, capturedSet);
      for (const idx of comboBasic) {
        capturedSet.add(idx);
        queue.push(idx);
      }
    }
  }

  const basic = basicCaptures(board, placedIndex, player, capturedSet);
  for (const idx of basic) capturedSet.add(idx);

  return {
    indices: [...capturedSet],
    trigger: trigger ?? (capturedSet.size > 0 ? "basic" : null),
  };
}

/** Basic-rule captures: strictly-greater touching ranks, for enemy cards adjacent to `fromIndex`. */
function basicCaptures(
  board: Cell[],
  fromIndex: number,
  player: PlayerId,
  alreadyCaptured: Set<number>
): number[] {
  const from = board[fromIndex];
  if (!from) return [];
  const results: number[] = [];
  for (const side of SIDES) {
    const idx = neighborIndex(fromIndex, side);
    if (idx === null || alreadyCaptured.has(idx)) continue;
    const cell = board[idx];
    if (!cell || cell.owner === player) continue;
    if (from.card.ranks[side] > cell.card.ranks[OPPOSITE[side]]) {
      results.push(idx);
    }
  }
  return results;
}

function determineWinner(board: Cell[]): PlayerId | "draw" {
  let a = 0;
  let b = 0;
  for (const cell of board) {
    if (cell?.owner === "A") a++;
    else if (cell?.owner === "B") b++;
  }
  if (a === b) return "draw";
  return a > b ? "A" : "B";
}

export function cardCounts(state: GameState): Record<PlayerId, number> {
  const counts: Record<PlayerId, number> = { A: 0, B: 0 };
  for (const cell of state.board) {
    if (cell) counts[cell.owner]++;
  }
  counts.A += state.hands.A.length;
  counts.B += state.hands.B.length;
  return counts;
}
