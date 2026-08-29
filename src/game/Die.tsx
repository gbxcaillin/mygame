import { useEffect, useState } from "react";
import die1 from "../assets/dice/die-1.png";
import die2 from "../assets/dice/die-2.png";
import die3 from "../assets/dice/die-3.png";
import die4 from "../assets/dice/die-4.png";
import die5 from "../assets/dice/die-5.png";
import die6 from "../assets/dice/die-6.png";
import "./Die.css";

/** The six gem faces, indexed 0-5 for values 1-6. Shared with the wager screen. */
export const DIE_FACES = [die1, die2, die3, die4, die5, die6];

interface DieProps {
  value: number; // 1-6, the landed result
  size?: number; // px
  /** play the tumble on mount; false shows the face statically */
  roll?: boolean;
  /** how many faces to flash before landing (higher = longer roll) */
  flips?: number;
  /** ms between face flashes */
  intervalMs?: number;
  /** called once the die settles on `value` */
  onLand?: () => void;
}

/**
 * Gem die that tumbles through faces and settles on `value`. Each value is a
 * different gem, so the roll flashes colours before it lands. Respects
 * prefers-reduced-motion (shows the result immediately).
 */
export function Die({ value, size = 64, roll = true, flips = 11, intervalMs = 55, onLand }: DieProps) {
  const [shown, setShown] = useState(value);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!roll || reduce) {
      setShown(value);
      onLand?.();
      return;
    }
    setSpinning(true);
    let n = 0;
    const iv = window.setInterval(() => {
      n += 1;
      if (n >= flips) {
        window.clearInterval(iv);
        setShown(value); // land on the real result
        setSpinning(false);
        onLand?.();
      } else {
        setShown(1 + Math.floor(Math.random() * 6));
      }
    }, intervalMs);
    return () => window.clearInterval(iv);
    // onLand intentionally omitted: a fresh closure each render must not restart the roll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, roll, flips, intervalMs]);

  return (
    <span
      className={`tt-die ${spinning ? "spinning" : "landed"}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Rolled ${value}`}
    >
      <img src={DIE_FACES[Math.min(6, Math.max(1, shown)) - 1]} alt="" draggable={false} />
    </span>
  );
}
