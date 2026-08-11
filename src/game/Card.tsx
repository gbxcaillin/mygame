import { useRef } from "react";
import type { Card as CardType, PlayerId } from "./types";
import "./Card.css";

interface CardProps {
  card: CardType;
  owner?: PlayerId;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onInspect: () => void;
}

const DOUBLE_TAP_MS = 320;

export function CardView({ card, owner, selected, disabled, onClick, onInspect }: CardProps) {
  const ownerClass = owner === "A" ? "owner-a" : owner === "B" ? "owner-b" : "";
  const classes = ["tt-card", ownerClass, selected ? "selected" : "", disabled ? "disabled" : ""]
    .filter(Boolean)
    .join(" ");

  const lastTapRef = useRef(0);

  function handleClick() {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_MS;
    // Reset after a double-tap so a rapid third click starts a fresh pair instead of chaining.
    lastTapRef.current = isDoubleTap ? 0 : now;

    if (isDoubleTap) {
      onInspect();
      return;
    }
    // Hand cards (onClick present) select on a single tap. Board cards (no onClick)
    // have nothing else to do on a single tap, so it's a no-op until the second tap.
    if (onClick && !disabled) onClick();
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      aria-disabled={disabled || undefined}
      aria-label={`${card.name}, top ${card.ranks.top}, bottom ${card.ranks.bottom}, left ${card.ranks.left}, right ${card.ranks.right}`}
    >
      {card.image && <img className="card-art" src={card.image} alt="" draggable={false} />}
      {/* Ranks are always rendered from game data, never read off the artwork: the
          source card sheet's baked-in numbers don't reliably match the real stats
          for every card, so this overlay is the only number players should trust. */}
      <span className="rank rank-top">{rankLabel(card.ranks.top)}</span>
      <span className="rank rank-left">{rankLabel(card.ranks.left)}</span>
      <span className="rank rank-right">{rankLabel(card.ranks.right)}</span>
      <span className="rank rank-bottom">{rankLabel(card.ranks.bottom)}</span>
      {!card.image && <span className="card-name">{card.name}</span>}
    </button>
  );
}

function rankLabel(n: number): string {
  return n === 10 ? "X" : String(n);
}
