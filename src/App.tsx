import { useMemo, useState } from "react";
import { Board } from "./game/Board";
import { Hand } from "./game/Hand";
import { createInitialState, placeCard } from "./game/engine";
import { dealHands } from "./game/cards";
import { DEFAULT_RULES } from "./game/types";
import type { Card, GameState, RuleSet } from "./game/types";
import "./App.css";

function newGame(rules: RuleSet): GameState {
  const { handA, handB } = dealHands();
  return createInitialState(handA, handB, "A", rules);
}

function App() {
  const [rules, setRules] = useState<RuleSet>(DEFAULT_RULES);
  const [state, setState] = useState<GameState>(() => newGame(rules));
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const counts = useMemo(() => {
    let a = 0;
    let b = 0;
    for (const cell of state.board) {
      if (cell?.owner === "A") a++;
      else if (cell?.owner === "B") b++;
    }
    return { a, b };
  }, [state.board]);

  function handleSelect(card: Card) {
    setSelectedCard((prev) => (prev?.id === card.id ? null : card));
  }

  function handleCellClick(index: number) {
    if (!selectedCard || state.winner) return;
    const next = placeCard(state, index, selectedCard);
    setState(next);
    setSelectedCard(null);
  }

  function handleNewGame(nextRules: RuleSet = rules) {
    setState(newGame(nextRules));
    setSelectedCard(null);
  }

  function toggleRule(key: keyof RuleSet) {
    const nextRules = { ...rules, [key]: !rules[key] };
    setRules(nextRules);
    handleNewGame(nextRules);
  }

  const winnerLabel =
    state.winner === "A" ? "Player 1 wins!" : state.winner === "B" ? "Player 2 wins!" : state.winner === "draw" ? "Draw!" : null;

  return (
    <div className="tt-app">
      <header className="tt-header">
        <h1>Triple Triad</h1>
        <button type="button" className="tt-new-game" onClick={() => handleNewGame()}>
          New Game
        </button>
      </header>

      <div className="tt-status-row">
        <div className={`tt-turn-indicator ${!state.winner ? `turn-${state.turn}` : ""}`}>
          {state.winner ? winnerLabel : `${state.turn === "A" ? "Player 1" : "Player 2"}'s turn`}
        </div>
        <div className="tt-score">
          <span className="score-a">P1: {counts.a}</span>
          <span className="score-b">P2: {counts.b}</span>
        </div>
      </div>

      <Hand
        player="B"
        cards={state.hands.B}
        isActive={state.turn === "B" && !state.winner}
        selectedCardId={selectedCard?.id ?? null}
        onSelect={handleSelect}
        label="Player 2"
      />

      <Board
        board={state.board}
        onCellClick={handleCellClick}
        canPlace={!!selectedCard && !state.winner}
        justCaptured={state.lastMove?.captured ?? []}
      />

      <Hand
        player="A"
        cards={state.hands.A}
        isActive={state.turn === "A" && !state.winner}
        selectedCardId={selectedCard?.id ?? null}
        onSelect={handleSelect}
        label="Player 1"
      />

      <fieldset className="tt-rules">
        <legend>Rules (changing restarts the match)</legend>
        <p className="tt-rules-note">
          Open is always on in local pass-and-play &mdash; both hands share one screen.
        </p>
        <label>
          <input type="checkbox" checked={rules.same} onChange={() => toggleRule("same")} />
          Same
        </label>
        <label>
          <input type="checkbox" checked={rules.plus} onChange={() => toggleRule("plus")} />
          Plus
        </label>
        <label>
          <input type="checkbox" checked={rules.combo} onChange={() => toggleRule("combo")} />
          Combo
        </label>
        <label>
          <input type="checkbox" checked={rules.sameWall} onChange={() => toggleRule("sameWall")} />
          Same Wall
        </label>
      </fieldset>
    </div>
  );
}

export default App;
