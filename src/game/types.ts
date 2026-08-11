export type Side = "top" | "bottom" | "left" | "right";

export type PlayerId = "A" | "B";

export interface Ranks {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type Rarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary"
  | "Mythic";

export interface Card {
  id: string;
  name: string;
  ranks: Ranks;
  rarity: Rarity;
  tier: number;
  image?: string;
}

export interface PlacedCard {
  card: Card;
  owner: PlayerId;
}

export type Cell = PlacedCard | null;

export interface RuleSet {
  open: boolean;
  same: boolean;
  plus: boolean;
  combo: boolean;
  sameWall: boolean;
}

export const DEFAULT_RULES: RuleSet = {
  open: true,
  same: true,
  plus: true,
  combo: true,
  sameWall: false,
};

export interface GameState {
  board: Cell[];
  hands: Record<PlayerId, Card[]>;
  turn: PlayerId;
  rules: RuleSet;
  winner: PlayerId | "draw" | null;
  lastMove: {
    cellIndex: number;
    captured: number[];
    trigger: "basic" | "same" | "plus" | null;
  } | null;
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === "A" ? "B" : "A";
}
