import { useEffect, useRef, useState } from "react";
import type { Cell, PlacedCard, PlayerId } from "./types";
import { CardView } from "./Card";
import "./Board.css";

interface BoardProps {
  board: Cell[];
  onCellClick: (index: number) => void;
  canPlace: boolean;
  justCaptured: number[];
  onInspect: (cell: PlacedCard) => void;
}

export function Board({ board, onCellClick, canPlace, justCaptured, onInspect }: BoardProps) {
  const prevBoardRef = useRef<Cell[]>(board);
  const [flipping, setFlipping] = useState<Set<number>>(new Set());
  const [prevOwners, setPrevOwners] = useState<Map<number, PlayerId>>(new Map());

  useEffect(() => {
    if (justCaptured.length === 0) {
      prevBoardRef.current = board;
      return;
    }

    const owners = new Map<number, PlayerId>();
    for (const idx of justCaptured) {
      const prev = prevBoardRef.current[idx];
      if (prev) owners.set(idx, prev.owner);
    }
    setPrevOwners(owners);
    setFlipping(new Set(justCaptured));

    const timer = setTimeout(() => {
      setFlipping(new Set());
      setPrevOwners(new Map());
    }, 950);

    prevBoardRef.current = board;
    return () => clearTimeout(timer);
  }, [board, justCaptured]);

  return (
    <div className="tt-board">
      {board.map((cell, i) => (
        <div key={i} className="tt-cell">
          {cell ? (
            <CardView
              card={cell.card}
              owner={cell.owner}
              flipping={flipping.has(i)}
              prevOwner={prevOwners.get(i)}
              onInspect={() => onInspect(cell)}
            />
          ) : (
            <button
              type="button"
              className="tt-empty-cell"
              disabled={!canPlace}
              onClick={() => onCellClick(i)}
              aria-label={`Place card on cell ${i + 1}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
