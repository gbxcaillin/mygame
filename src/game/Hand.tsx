import type { Ref } from "react";
import type { Card, PlayerId } from "./types";
import { CardView } from "./Card";
import "./Hand.css";

interface HandProps {
  player: PlayerId;
  cards: Card[];
  isActive: boolean;
  selectedCardId: string | null;
  onSelect: (card: Card) => void;
  onInspect: (card: Card) => void;
  label: string;
  cardsRowRef?: Ref<HTMLDivElement>;
}

export function Hand({ player, cards, isActive, selectedCardId, onSelect, onInspect, label, cardsRowRef }: HandProps) {
  return (
    <div className={`tt-hand ${isActive ? "active" : ""}`}>
      <h3 className="tt-hand-label">{label}</h3>
      <div className="tt-hand-cards" ref={cardsRowRef}>
        {cards.map((card) => (
          <CardView
            key={card.id}
            card={card}
            owner={player}
            selected={card.id === selectedCardId}
            disabled={!isActive}
            onClick={() => onSelect(card)}
            onInspect={() => onInspect(card)}
          />
        ))}
        {cards.length === 0 && <p className="tt-hand-empty">No cards left</p>}
      </div>
    </div>
  );
}
