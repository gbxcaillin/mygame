import { useState } from "react";
import { CARD_POOL } from "./cards";
import {
  deleteDeck,
  loadCollection,
  saveDeck,
  setActiveDeck,
  totalOwnedDistinct,
} from "./collection";
import "./CollectionPanel.css";

interface CollectionPanelProps {
  onClose: () => void;
  /** notify the app that owned cards / decks changed (deck dropdown etc.) */
  onChanged: () => void;
}

const TIER_NAMES = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];

export function CollectionPanel({ onClose, onChanged }: CollectionPanelProps) {
  const [, setTick] = useState(0);
  const [picking, setPicking] = useState<string[] | null>(null);
  const [deckName, setDeckName] = useState("");

  const col = loadCollection();
  const refresh = () => {
    setTick((t) => t + 1);
    onChanged();
  };

  function togglePick(cardId: string) {
    if (!picking) return;
    if ((col.owned[cardId] ?? 0) === 0) return;
    setPicking((prev) => {
      if (!prev) return prev;
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= 5) return prev;
      return [...prev, cardId];
    });
  }

  function confirmDeck() {
    if (!picking || picking.length !== 5) return;
    saveDeck(deckName, picking);
    setPicking(null);
    setDeckName("");
    refresh();
  }

  return (
    <div className="tt-col-veil" role="dialog" aria-modal="true" aria-label="Collection">
      <div className="tt-col">
        <div className="tt-col-head">
          <h2>
            Collection <span className="tt-col-count">{totalOwnedDistinct()} / {CARD_POOL.length}</span>
          </h2>
          <button type="button" className="tt-col-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {picking ? (
          <div className="tt-col-deckbar building">
            <span>
              Pick 5 owned cards — {picking.length} / 5
            </span>
            <input
              value={deckName}
              placeholder="Deck name"
              maxLength={20}
              onChange={(e) => setDeckName(e.target.value)}
              aria-label="Deck name"
            />
            <button type="button" className="tt-new-game" disabled={picking.length !== 5} onClick={confirmDeck}>
              Save deck
            </button>
            <button type="button" className="tt-col-linkbtn" onClick={() => setPicking(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="tt-col-deckbar">
            <span className="tt-col-decks-label">Decks:</span>
            {col.decks.length === 0 && <span className="tt-col-none">none yet</span>}
            {col.decks.map((deck) => (
              <span key={deck.id} className={`tt-col-deckchip ${deck.id === col.activeDeckId ? "active" : ""}`}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDeck(deck.id);
                    refresh();
                  }}
                  title="Use this deck"
                >
                  {deck.name}
                </button>
                <button
                  type="button"
                  className="tt-col-deckdel"
                  aria-label={`Delete ${deck.name}`}
                  onClick={() => {
                    deleteDeck(deck.id);
                    refresh();
                  }}
                >
                  &times;
                </button>
              </span>
            ))}
            <button type="button" className="tt-new-game tt-col-newdeck" onClick={() => setPicking([])}>
              New deck
            </button>
          </div>
        )}

        <div className="tt-col-grid">
          {[1, 2, 3, 4, 5, 6].map((tier) => (
            <section key={tier} className="tt-col-tier">
              <h3>{TIER_NAMES[tier - 1]}</h3>
              <div className="tt-col-cards">
                {CARD_POOL.filter((c) => c.tier === tier).map((card) => {
                  const count = col.owned[card.id] ?? 0;
                  const owned = count > 0;
                  const sel = picking?.includes(card.id) ?? false;
                  return (
                    <div
                      key={card.id}
                      className={`tt-col-card ${owned ? "owned" : "missing"} ${sel ? "sel" : ""} ${picking && owned ? "pickable" : ""}`}
                      role={picking && owned ? "button" : undefined}
                      onClick={() => togglePick(card.id)}
                      title={owned ? card.name : "Not collected yet"}
                    >
                      {card.image ? (
                        <img src={card.image} alt={owned ? card.name : "Unknown card"} draggable={false} />
                      ) : (
                        <span className="tt-col-name">{card.name}</span>
                      )}
                      {count > 1 && <span className="tt-col-copies">×{count}</span>}
                      {sel && <span className="tt-col-tick">✓</span>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <p className="tt-col-hint">Beat the Computer to win new cards — higher difficulty, rarer finds.</p>
      </div>
    </div>
  );
}
