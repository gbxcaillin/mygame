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

const HAND_SIZE = 5;

export function Hand({ player, cards, isActive, selectedCardId, onSelect, onInspect, label, cardsRowRef }: HandProps) {
  // Played cards leave an empty faction-toned socket, keeping the row's
  // footprint stable (the sockets live in the DOM so they always align
  // with the cards, unlike backdrop-painted ones).
  const empties = Math.max(0, HAND_SIZE - cards.length);
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
        {Array.from({ length: empties }, (_, i) => (
          <div key={`socket-${i}`} className={`tt-hand-socket socket-${player === "A" ? "a" : "b"}`} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
