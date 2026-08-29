import { useEffect, useState } from "react";
import type { Card } from "./types";
import { DIE_FACES } from "./Die";
import "./WagerRoll.css";

interface WagerRollProps {
  /** The loser's five fielded cards, in play order (slots 1-5). */
  field: Card[];
  /** The d6 result, 1-6. */
  roll: number;
  /** The card actually taken (for roll 6 this is a benched reserve card). */
  taken: Card | null;
  /** true = you won the roll and take a card; false = you lost one. */
  won: boolean;
  onContinue: () => void;
}

const ROLL_MS = 2200;
const CURSOR_MS = 140;

/**
 * A dedicated wager-resolution screen: the die tumbles while a highlight walks
 * across the six cards on the line (1-5 the fielded cards, 6 a reserve), then
 * locks onto the rolled number and reveals the card that changes hands.
 */
export function WagerRoll({ field, roll, taken, won, onContinue }: WagerRollProps) {
  const [phase, setPhase] = useState<"rolling" | "landed">("rolling");
  const [cursor, setCursor] = useState(1);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCursor(roll);
      setPhase("landed");
      return;
    }
    const iv = window.setInterval(() => setCursor((c) => 1 + (c % 6)), CURSOR_MS);
    const t = window.setTimeout(() => {
      window.clearInterval(iv);
      setCursor(roll);
      setPhase("landed");
    }, ROLL_MS);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(t);
    };
  }, [roll]);

  const landed = phase === "landed";
  const activeSlot = landed ? roll : cursor;
  const dieFace = DIE_FACES[activeSlot - 1];

  // Slot 6 is the reserve card: face-down until the roll actually lands on it.
  const reserveRevealed = landed && roll === 6 ? taken : null;

  return (
    <div className="tt-wr" role="dialog" aria-label="Wager roll">
      <div className="tt-wr-inner">
        <p className={`tt-wr-heading ${landed ? (won ? "won" : "lost") : ""}`}>
          {landed
            ? won
              ? "You won this card!"
              : "You lost this card!"
            : won
              ? "Rolling for their card…"
              : "Rolling for your card…"}
        </p>

        <div className={`tt-wr-die ${landed ? "landed" : "spinning"}`}>
          <img src={dieFace} alt={`Rolled ${activeSlot}`} draggable={false} />
        </div>

        <div className="tt-wr-line">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const slot = i + 1;
            const card = slot === 6 ? reserveRevealed : field[i] ?? null;
            const isReserve = slot === 6;
            const active = activeSlot === slot;
            const isTaken = landed && roll === slot;
            const dim = landed && !isTaken;
            return (
              <div
                key={slot}
                className={`tt-wr-slot${active ? " active" : ""}${isTaken ? " taken" : ""}${dim ? " dim" : ""}`}
              >
                <span className="tt-wr-num">{slot}</span>
                {isReserve && !reserveRevealed ? (
                  <div className="tt-wr-back" aria-label="Reserve card">
                    <span>?</span>
                  </div>
                ) : card && card.image ? (
                  <img className="tt-wr-card" src={card.image} alt={card.name} draggable={false} />
                ) : (
                  <div className="tt-wr-back">
                    <span>{card?.name ?? "?"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {landed && (
          <>
            <p className="tt-wr-caption">
              <b>{taken?.name ?? "A card"}</b>
              {won ? " goes to your collection." : " goes to your friend."}
              {roll === 6 && " (reserve — the sixth roll)"}
            </p>
            <button type="button" className="tt-wr-continue" onClick={onContinue}>
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
