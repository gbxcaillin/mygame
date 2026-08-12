import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Board } from "./game/Board";
import { Hand } from "./game/Hand";
import { CardLightbox } from "./game/CardLightbox";
import { TutorialModal } from "./game/TutorialModal";
import { createInitialState, placeCard } from "./game/engine";
import { dealHands } from "./game/cards";
import { chooseAiMove, DIFFICULTY_LABELS } from "./game/ai";
import type { Difficulty } from "./game/ai";
import { DEFAULT_RULES } from "./game/types";
import type { Card, GameState, PlayerId, RuleSet } from "./game/types";
import backdrop from "./assets/clash-of-beasts-backdrop.png";
import "./App.css";

type OpponentType = "human" | "ai";
const AI_THINK_DELAY_MS = 550;

// Must match the padding + gap set on .tt-board in Board.css (2 * padding + 2 * gap).
const MIN_CARD_PX = 36;
const MAX_CARD_PX = 140;

function newGame(rules: RuleSet): GameState {
  const { handA, handB } = dealHands();
  return createInitialState(handA, handB, "A", rules);
}

function App() {
  const [rules, setRules] = useState<RuleSet>(DEFAULT_RULES);
  const [state, setState] = useState<GameState>(() => newGame(rules));
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cardSize, setCardSize] = useState(64);
  const [opponentType, setOpponentType] = useState<OpponentType>("ai");
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [aiThinking, setAiThinking] = useState(false);
  const [inspecting, setInspecting] = useState<{ card: Card; owner?: PlayerId } | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const appRef = useRef<HTMLDivElement>(null);
  const handRowRef = useRef<HTMLDivElement>(null);

  const recompute = useCallback(() => {
    const stage = appRef.current;
    if (!stage) return;

    // Size cards from the fixed 2:3 artwork stage so the live board and hands
    // remain aligned with the background at every viewport size.
    const byWidth = stage.clientWidth * 0.115;
    const byHeight = stage.clientHeight * 0.077;
    const next = Math.floor(
      Math.max(MIN_CARD_PX, Math.min(MAX_CARD_PX, Math.min(byWidth, byHeight)))
    );

    setCardSize((prev) => (Math.abs(next - prev) > 0.5 ? next : prev));
  }, []);

  useLayoutEffect(() => {
    recompute();
  }, [recompute, state.turn, state.winner, rulesOpen]);

  useEffect(() => {
    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    window.visualViewport?.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
      window.visualViewport?.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  useEffect(() => {
    if (opponentType !== "ai" || state.turn !== "B" || state.winner) {
      setAiThinking(false);
      return;
    }
    setAiThinking(true);
    const timer = setTimeout(() => {
      const move = chooseAiMove(state, "B", difficulty);
      setState((prev) => (prev.turn === "B" && !prev.winner ? placeCard(prev, move.cellIndex, move.card) : prev));
      setAiThinking(false);
    }, AI_THINK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, opponentType, difficulty]);

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

  const player2Label = opponentType === "ai" ? "Computer" : "Player 2";
  const winnerLabel =
    state.winner === "A"
      ? "Player 1 wins!"
      : state.winner === "B"
        ? `${player2Label} wins!`
        : state.winner === "draw"
          ? "Draw!"
          : null;

  return (
    <div className="tt-app-outer">
      <div className="tt-backdrop-blur" aria-hidden="true">
        <img src={backdrop} alt="" />
      </div>

      <div
        className="tt-app"
        ref={appRef}
        style={{ "--card-size": `${cardSize}px` } as CSSProperties}
      >
        <img src={backdrop} className="tt-backdrop" alt="" aria-hidden="true" />

        <header className="tt-header">
          <h1 className="tt-title-accessible">Clash of Beasts</h1>
          <button
            type="button"
            className="tt-help-btn"
            onClick={() => setTutorialOpen(true)}
            aria-label="How to play"
          >
            ?
          </button>
          <button type="button" className="tt-new-game" onClick={() => handleNewGame()}>
            New Game
          </button>
          <details
            className="tt-rules"
            open={rulesOpen}
            onToggle={(e) => setRulesOpen(e.currentTarget.open)}
          >
            <summary>Rules {rulesOpen ? "▾" : "▸"}</summary>
            <div className="tt-rules-content">
              <p className="tt-rules-note">
                Changing a rule restarts the match.
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
            </div>
          </details>
        </header>

        <div className="tt-status-row">
          <div className={`tt-turn-indicator ${!state.winner ? `turn-${state.turn}` : ""}`}>
            {state.winner
              ? winnerLabel
              : aiThinking
                ? `${player2Label} is thinking…`
                : `${state.turn === "A" ? "Player 1" : player2Label}'s turn`}
          </div>
          <div className="tt-score">
            <span className="score-a">P1: {counts.a}</span>
            <span className="score-b">P2: {counts.b}</span>
          </div>
        </div>

        <div className="tt-opponent-row">
          <label>
            Opponent
            <select
              value={opponentType}
              onChange={(e) => setOpponentType(e.target.value as OpponentType)}
            >
              <option value="ai">Computer</option>
              <option value="human">Human (pass &amp; play)</option>
            </select>
          </label>
          {opponentType === "ai" && (
            <label>
              Difficulty
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value) as Difficulty)}
              >
                {([1, 2, 3, 4, 5] as const).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <section className="tt-hand-shell tt-hand-shell-b">
        <Hand
          player="B"
          cards={state.hands.B}
          isActive={state.turn === "B" && !state.winner && opponentType === "human"}
          selectedCardId={selectedCard?.id ?? null}
          onSelect={handleSelect}
          onInspect={(card) => setInspecting({ card, owner: "B" })}
          label={player2Label}
        />
        </section>

        <div className="tt-board-area">
          <Board
            board={state.board}
            onCellClick={handleCellClick}
            canPlace={!!selectedCard && !state.winner}
            justCaptured={state.lastMove?.captured ?? []}
            onInspect={(cell) => setInspecting({ card: cell.card, owner: cell.owner })}
          />
        </div>

        <section className="tt-hand-shell tt-hand-shell-a">
        <Hand
          player="A"
          cards={state.hands.A}
          isActive={state.turn === "A" && !state.winner}
          selectedCardId={selectedCard?.id ?? null}
          onSelect={handleSelect}
          onInspect={(card) => setInspecting({ card, owner: "A" })}
          label="Player 1"
          cardsRowRef={handRowRef}
        />
        </section>

        <p className="tt-hint">Double-tap any card to see it full size.</p>
      </div>
      {inspecting && (
        <CardLightbox card={inspecting.card} owner={inspecting.owner} onClose={() => setInspecting(null)} />
      )}
      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}
    </div>
  );
}

export default App;
