import { useRef } from "react";
import type { Card as CardType, PlayerId } from "./types";
import "./Card.css";

interface CardProps {
  card: CardType;
  owner?: PlayerId;
  selected?: boolean;
  disabled?: boolean;
  flipping?: boolean;
  prevOwner?: PlayerId;
  onClick?: () => void;
  onInspect: () => void;
}

const DOUBLE_TAP_MS = 320;

function ownerClassName(owner?: PlayerId) {
  return owner === "A" ? "owner-a" : owner === "B" ? "owner-b" : "";
}

export function CardView({ card, owner, selected, disabled, flipping, prevOwner, onClick, onInspect }: CardProps) {
  const classes = ["tt-card", ownerClassName(owner), selected ? "selected" : "", disabled ? "disabled" : ""]
    .filter(Boolean)
    .join(" ");

  const lastTapRef = useRef(0);

  function handleClick() {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_MS;
    lastTapRef.current = isDoubleTap ? 0 : now;

    if (isDoubleTap) {
      onInspect();
      return;
    }
    if (onClick && !disabled) onClick();
  }

  const cardContent = card.image ? (
    <img className="card-art" src={card.image} alt="" draggable={false} />
  ) : (
    <>
      <span className="rank rank-top">{rankLabel(card.ranks.top)}</span>
      <span className="rank rank-left">{rankLabel(card.ranks.left)}</span>
      <span className="rank rank-right">{rankLabel(card.ranks.right)}</span>
      <span className="rank rank-bottom">{rankLabel(card.ranks.bottom)}</span>
      <span className="card-name">{card.name}</span>
    </>
  );

  if (flipping && prevOwner) {
    const frontClass = `tt-card ${ownerClassName(prevOwner)}`;
    const backClass = `tt-card ${ownerClassName(owner)}`;

    return (
      <div className="tt-card-flip-container flipping">
        <div className="tt-card-flipper">
          <button type="button" className={`${frontClass} tt-card-face tt-card-front`} aria-hidden="true">
            {cardContent}
          </button>
          <button
            type="button"
            className={`${backClass} tt-card-face tt-card-back`}
            onClick={handleClick}
            onContextMenu={(e) => e.preventDefault()}
            aria-disabled={disabled || undefined}
            aria-label={`${card.name}, top ${card.ranks.top}, bottom ${card.ranks.bottom}, left ${card.ranks.left}, right ${card.ranks.right}`}
          >
            {cardContent}
          </button>
        </div>
      </div>
    );
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
      {cardContent}
    </button>
  );
}

function rankLabel(n: number): string {
  return n === 10 ? "X" : String(n);
}
