import { useEffect } from "react";
import type { Card, PlayerId } from "./types";
import "./CardLightbox.css";

interface CardLightboxProps {
  card: Card;
  owner?: PlayerId;
  onClose: () => void;
}

export function CardLightbox({ card, owner, onClose }: CardLightboxProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ownerClass = owner === "A" ? "owner-a" : owner === "B" ? "owner-b" : "";

  return (
    <div className="tt-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={card.name}>
      <div className={`tt-lightbox-card ${ownerClass}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="tt-lightbox-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        {card.image ? (
          <>
            <img src={card.image} alt={card.name} />
            {/* Overlaid because the source card sheet's baked-in numbers don't reliably
                match the real stats for every card - this is the only number to trust. */}
            <span className="tt-lightbox-rank top">{rankLabel(card.ranks.top)}</span>
            <span className="tt-lightbox-rank left">{rankLabel(card.ranks.left)}</span>
            <span className="tt-lightbox-rank right">{rankLabel(card.ranks.right)}</span>
            <span className="tt-lightbox-rank bottom">{rankLabel(card.ranks.bottom)}</span>
          </>
        ) : (
          <div className="tt-lightbox-fallback">
            <span className="tt-lightbox-name">{card.name}</span>
            <div className="tt-lightbox-ranks">
              <span>{rankLabel(card.ranks.top)}</span>
              <span>{rankLabel(card.ranks.left)}</span>
              <span>{rankLabel(card.ranks.right)}</span>
              <span>{rankLabel(card.ranks.bottom)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function rankLabel(n: number): string {
  return n === 10 ? "X" : String(n);
}
