import type { Card as CardType, PlayerId } from "./types";
import "./Card.css";

interface CardProps {
  card: CardType;
  owner?: PlayerId;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function CardView({ card, owner, selected, disabled, onClick }: CardProps) {
  const ownerClass = owner === "A" ? "owner-a" : owner === "B" ? "owner-b" : "";
  const classes = ["tt-card", ownerClass, selected ? "selected" : "", disabled ? "disabled" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
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
  return n === 10 ? "A" : String(n);
}
