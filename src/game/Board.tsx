import type { Cell, PlacedCard } from "./types";
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
  return (
    <div className="tt-board">
      {board.map((cell, i) => (
        <div key={i} className={`tt-cell ${justCaptured.includes(i) ? "flash" : ""}`}>
          {cell ? (
            <CardView card={cell.card} owner={cell.owner} onInspect={() => onInspect(cell)} />
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
