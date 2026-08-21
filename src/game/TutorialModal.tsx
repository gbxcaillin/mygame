import { useEffect } from "react";
import "./TutorialModal.css";

interface TutorialModalProps {
  onClose: () => void;
}

export function TutorialModal({ onClose }: TutorialModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="tt-tutorial-veil" onClick={onClose} role="dialog" aria-modal="true" aria-label="How to play">
      <div className="tt-tutorial-panel" onClick={(e) => e.stopPropagation()}>
        <div className="tt-tutorial-head">
          <h2>How to Play</h2>
          <button type="button" className="tt-tutorial-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="tt-tutorial-body">
          <section>
            <h3>Goal</h3>
            <p>Capture more cards than your opponent. When all 9 board spaces are filled, whoever owns more cards wins.</p>
          </section>

          <section>
            <h3>The coin toss</h3>
            <p>
              Every match starts with a coin flip &mdash; tap the coin to toss it. The gold crown means you go
              first; the silver shield means your opponent does.
            </p>
          </section>

          <section>
            <h3>Playing a card</h3>
            <p>
              Tap a card in your hand to select it, then tap an empty socket on the board to place it there. Your
              cards glow <strong>blue</strong>; your opponent's glow <strong>red</strong>.
            </p>
          </section>

          <section>
            <h3>Capturing</h3>
            <p>
              Every card has four numbers &mdash; top, left, right, and bottom. When you place a card next to an
              enemy card, compare the two touching sides. If your number is higher, you capture their card and it
              flips to your color. Ties don't capture.
            </p>
          </section>

          <section>
            <h3>Special rules</h3>
            <ul>
              <li>
                <strong>Same</strong> &mdash; if 2 or more touching sides match the enemy cards' numbers exactly,
                capture all of them.
              </li>
              <li>
                <strong>Plus</strong> &mdash; if 2 or more pairs of touching sides add up to the same sum, capture
                all of them.
              </li>
              <li>
                <strong>Combo</strong> &mdash; cards captured by Same or Plus can chain into further captures
                against their own neighbors.
              </li>
              <li>
                <strong>Same Wall</strong> &mdash; the board edge counts as a 10 for Same, so a side facing the wall
                can help trigger it too.
              </li>
            </ul>
            <p>Toggle these with the Rules checkboxes in the controls &mdash; changing one starts a new match.</p>
          </section>

          <section>
            <h3>Your deck</h3>
            <p>
              The Deck dropdown sets how your hand is dealt. <strong>Random</strong> deals 5 cards;{" "}
              <strong>Select</strong> shows a spread of 10 and lets you draft your favourite 5 (tap a card to pick
              it, tap the magnifier to enlarge it).
            </p>
            <p>
              Creatures follow a rarity pyramid &mdash; Commons and Uncommons appear often, while Legendary and
              Mythic beasts like the Dragon or Kraken are rare finds.
            </p>
          </section>

          <section>
            <h3>Opponent &amp; difficulty</h3>
            <p>
              Pick Human for local pass-and-play, or Computer for an AI opponent with five difficulty levels, from
              Beginner (random moves) to Expert (plans several moves ahead).
            </p>
          </section>

          <section>
            <h3>Sound</h3>
            <p>
              The Sound checkboxes turn the music and the sound effects on or off independently &mdash; your choice
              is remembered for next time.
            </p>
          </section>

          <section>
            <h3>Tip</h3>
            <p>Double-tap any card &mdash; in your hand or on the board &mdash; to see it full size.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
