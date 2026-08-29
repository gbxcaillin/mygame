import { useEffect, useState } from "react";
import die1 from "../assets/dice/die-1.png";
import die2 from "../assets/dice/die-2.png";
import die3 from "../assets/dice/die-3.png";
import die4 from "../assets/dice/die-4.png";
import die5 from "../assets/dice/die-5.png";
import die6 from "../assets/dice/die-6.png";
import "./Die.css";

const FACES = [die1, die2, die3, die4, die5, die6];

interface DieProps {
  value: number; // 1-6, the landed result
  size?: number; // px
  /** play the tumble on mount; false shows the face statically */
  roll?: boolean;
}

/**
 * Gem die that tumbles through faces and settles on `value`. Each value is a
 * different gem, so the roll flashes colours before it lands. Respects
 * prefers-reduced-motion (shows the result immediately).
 */
export function Die({ value, size = 64, roll = true }: DieProps) {
  const [shown, setShown] = useState(value);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!roll || reduce) {
      setShown(value);
      return;
    }
    setSpinning(true);
    let flips = 0;
    const iv = window.setInterval(() => {
      flips += 1;
      if (flips >= 11) {
        window.clearInterval(iv);
        setShown(value); // land on the real result
        setSpinning(false);
      } else {
        setShown(1 + Math.floor(Math.random() * 6));
      }
    }, 55);
    return () => window.clearInterval(iv);
  }, [value, roll]);

  return (
    <span
      className={`tt-die ${spinning ? "spinning" : "landed"}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Rolled ${value}`}
    >
      <img src={FACES[Math.min(6, Math.max(1, shown)) - 1]} alt="" draggable={false} />
    </span>
  );
}
