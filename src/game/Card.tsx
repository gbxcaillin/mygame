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

const LONG_PRESS_MS = 420;

export function CardView({ card, owner, selected, disabled, onClick, onInspect }: CardProps) {
  const ownerClass = owner === "A" ? "owner-a" : owner === "B" ? "owner-b" : "";
  const classes = ["tt-card", ownerClass, selected ? "selected" : "", disabled ? "disabled" : ""]
    .filter(Boolean)
    .join(" ");

  const timerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  function startPress() {
    longPressFiredRef.current = false;
    timerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      onInspect();
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleClick() {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    // Hand cards (onClick present) select on tap and inspect on long-press.
    // Board cards (no onClick) have nothing else to do on tap, so tap inspects directly.
    if (onClick) {
      if (!disabled) onClick();
    } else {
      onInspect();
    }
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      aria-disabled={disabled || undefined}
      aria-label={`${card.name}, top ${card.ranks.top}, bottom ${card.ranks.bottom}, left ${card.ranks.left}, right ${card.ranks.right}`}
    >
      {card.image ? (
        <img className="card-art" src={card.image} alt="" draggable={false} />
      ) : (
        <>
          <span className="rank rank-top">{rankLabel(card.ranks.top)}</span>
          <span className="rank rank-left">{rankLabel(card.ranks.left)}</span>
          <span className="rank rank-right">{rankLabel(card.ranks.right)}</span>
          <span className="rank rank-bottom">{rankLabel(card.ranks.bottom)}</span>
          <span className="card-name">{card.name}</span>
        </>
      )}
    </button>
  );
}

function rankLabel(n: number): string {
  return n === 10 ? "X" : String(n);
}
