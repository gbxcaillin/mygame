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

type Phase = "announce" | "rolling" | "result";

/**
 * The wager resolution, paced as an event the player taps through:
 *   1. announce  — "You lost the wager", tap to roll
 *   2. rolling   — the six cards on the line, the die tumbling across them
 *   3. result    — locks on the rolled number, reveals the card, tap to continue
 */
export function WagerRoll({ field, roll, taken, won, onContinue }: WagerRollProps) {
  const [phase, setPhase] = useState<Phase>("announce");
  const [cursor, setCursor] = useState(1);

  useEffect(() => {
    if (phase !== "rolling") return;
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCursor(roll);
      setPhase("result");
      return;
    }
    const iv = window.setInterval(() => setCursor((c) => 1 + (c % 6)), CURSOR_MS);
    const t = window.setTimeout(() => {
      window.clearInterval(iv);
      setCursor(roll);
      setPhase("result");
    }, ROLL_MS);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(t);
    };
  }, [phase, roll]);

  const rolling = phase === "rolling";
  const result = phase === "result";
  const showCards = phase !== "announce";
  // Idle on face 1 before the roll so nothing is given away.
  const activeSlot = result ? roll : rolling ? cursor : 1;
  const dieFace = DIE_FACES[activeSlot - 1];
  // The winner only knows the loser's candidates if they were sent along; when
  // they weren't, the line still rolls and the taken card is revealed on landing.
  const haveField = field.length > 0;

  return (
    <div className="tt-wr" role="dialog" aria-label="Wager roll">
      <div className="tt-wr-inner">
        <p className={`tt-wr-heading ${result ? (won ? "won" : "lost") : ""}`}>
          {phase === "announce"
            ? won
              ? "You won the wager!"
              : "You lost the wager!"
            : rolling
              ? "Rolling…"
              : won
                ? "You won this card!"
                : "You lost this card!"}
        </p>

        {phase === "announce" && (
          <p className="tt-wr-sub">
            {won ? "Roll to see which card you claim." : "Roll to see which card you forfeit."}
          </p>
        )}

        <div className={`tt-wr-die ${rolling ? "spinning" : result ? "landed" : "idle"}`}>
          <img src={dieFace} alt={rolling || result ? `Rolled ${activeSlot}` : "Die"} draggable={false} />
        </div>

        {showCards && (
          <div className="tt-wr-line">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const slot = i + 1;
              const active = (rolling || result) && activeSlot === slot;
              const isTaken = result && roll === slot;
              const dim = result && !isTaken;
              // The taken card is always revealed in its slot on landing, even
              // when the candidate list wasn't supplied (slot 6 is the reserve).
              const card = isTaken ? taken : slot === 6 ? null : field[i] ?? null;
              return (
                <div
                  key={slot}
                  className={`tt-wr-slot${active ? " active" : ""}${isTaken ? " taken" : ""}${dim ? " dim" : ""}`}
                >
                  <span className="tt-wr-num">{slot}</span>
                  {card && card.image ? (
                    <img className="tt-wr-card" src={card.image} alt={card.name} draggable={false} />
                  ) : (
                    <div className="tt-wr-back" aria-label={slot === 6 ? "Reserve card" : "Card"}>
                      <span>?</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {phase === "announce" && (
          <button type="button" className="tt-wr-continue" onClick={() => setPhase("rolling")}>
            Roll the dice
          </button>
        )}

        {result && (
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
