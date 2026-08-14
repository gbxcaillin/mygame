import { useEffect, useMemo, useState } from "react";
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
import titleLogo from "./assets/title.png";
import bgLandscape from "./assets/bg-landscape.png";
import bgPortrait from "./assets/bg-portrait.png";
import {
  startMusic,
  getAudioSettings,
  playFlip,
  playWin,
  playLose,
  setMusicEnabled,
  setSfxEnabled,
} from "./audio";
import "./App.css";

type OpponentType = "human" | "ai";
const AI_THINK_DELAY_MS = 1400;

function newGame(rules: RuleSet): GameState {
  const { handA, handB } = dealHands();
  return createInitialState(handA, handB, "A", rules);
}

function App() {
  const [rules, setRules] = useState<RuleSet>(DEFAULT_RULES);
  const [state, setState] = useState<GameState>(() => newGame(rules));
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [opponentType, setOpponentType] = useState<OpponentType>("ai");
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [aiThinking, setAiThinking] = useState(false);
  const [inspecting, setInspecting] = useState<{ card: Card; owner?: PlayerId } | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [audio, setAudio] = useState(getAudioSettings);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [started, setStarted] = useState(false);

  // Card-flip sound whenever a move captures one or more cards.
  useEffect(() => {
    if (state.lastMove && state.lastMove.captured.length > 0) playFlip();
  }, [state.lastMove]);

  // Win / lose stinger + reset the banner when a match ends or restarts.
  useEffect(() => {
    if (state.winner === "A") playWin();
    else if (state.winner === "B") playLose();
    else if (state.winner === "draw") playLose();
    if (!state.winner) setBannerDismissed(false);
  }, [state.winner]);

  useEffect(() => {
    if (opponentType !== "ai" || state.turn !== "B" || state.winner) {
      setAiThinking(false);
      return;
    }
    setAiThinking(true);
    const timer = setTimeout(() => {
      const move = chooseAiMove(state, "B", difficulty);
      setState((prev) =>
        prev.turn === "B" && !prev.winner ? placeCard(prev, move.cellIndex, move.card) : prev
      );
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
    setState(placeCard(state, index, selectedCard));
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

  function toggleMusic() {
    const next = !audio.music;
    setMusicEnabled(next);
    setAudio((a) => ({ ...a, music: next }));
  }

  function toggleSfx() {
    const next = !audio.sfx;
    setSfxEnabled(next);
    setAudio((a) => ({ ...a, sfx: next }));
  }

  // Press Start: a direct user gesture that reliably kicks off music.
  function handleStart() {
    startMusic();
    setStarted(true);
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

  const status = state.winner
    ? winnerLabel
    : aiThinking
      ? `${player2Label} is thinking…`
      : `${state.turn === "A" ? "Player 1" : player2Label}'s turn`;

  const bannerKind =
    state.winner === "A" ? "win" : state.winner === "B" ? "lose" : "draw";
  const bannerTitle =
    state.winner === "draw"
      ? "Draw"
      : opponentType === "ai"
        ? state.winner === "A"
          ? "You Won!"
          : "You Lost…"
        : state.winner === "A"
          ? "Player 1 Wins!"
          : "Player 2 Wins!";
  const showBanner = !!state.winner && !bannerDismissed;

  return (
    <>
      <picture>
        <source srcSet={bgPortrait} media="(orientation: portrait)" />
        <img src={bgLandscape} className="tt-backdrop" alt="" aria-hidden="true" />
      </picture>

      <div className="tt-app">
      <h1 className="tt-title">
        <img src={titleLogo} alt="Clash of Beasts" />
      </h1>

      <div className="tt-game">
        <section className="tt-hand-shell">
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

        <section className="tt-hand-shell">
          <Hand
            player="A"
            cards={state.hands.A}
            isActive={state.turn === "A" && !state.winner}
            selectedCardId={selectedCard?.id ?? null}
            onSelect={handleSelect}
            onInspect={(card) => setInspecting({ card, owner: "A" })}
            label="Player 1"
          />
        </section>
      </div>

      <div className="tt-panel">
      <div className="tt-topbar">
        <button type="button" className="tt-new-game" onClick={() => handleNewGame()}>
          New Game
        </button>
        <div className={`tt-status ${!state.winner ? `turn-${state.turn}` : ""}`}>
          <span className="tt-status-text">{status}</span>
          <span className="tt-score">
            <span className="score-a">P1: {counts.a}</span>
            <span className="score-b">
              {opponentType === "ai" ? "CPU" : "P2"}: {counts.b}
            </span>
          </span>
        </div>
      </div>

      <div className="tt-bottombar">
        <div className="tt-controls">
          <button type="button" className="tt-help-btn" onClick={() => setTutorialOpen(true)}>
            How to play
          </button>

          <label className="tt-field">
            Opponent
            <select value={opponentType} onChange={(e) => setOpponentType(e.target.value as OpponentType)}>
              <option value="ai">Computer</option>
              <option value="human">Human</option>
            </select>
          </label>

          {opponentType === "ai" && (
            <label className="tt-field">
              Difficulty
              <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as Difficulty)}>
                {([1, 2, 3, 4, 5] as const).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <fieldset className="tt-rules">
          <legend>Rules</legend>
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

        <fieldset className="tt-rules tt-sound">
          <legend>Sound</legend>
          <label>
            <input type="checkbox" checked={audio.music} onChange={toggleMusic} />
            Music
          </label>
          <label>
            <input type="checkbox" checked={audio.sfx} onChange={toggleSfx} />
            Effects
          </label>
        </fieldset>
      </div>
      </div>

      {inspecting && (
        <CardLightbox card={inspecting.card} owner={inspecting.owner} onClose={() => setInspecting(null)} />
      )}
      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}

      {showBanner && (
        <div className="tt-winbanner-veil" onClick={() => setBannerDismissed(true)}>
          <div className={`tt-winbanner ${bannerKind}`} onClick={(e) => e.stopPropagation()}>
            <h2 className="tt-winbanner-title">{bannerTitle}</h2>
            <p className="tt-winbanner-score">
              Player 1 {counts.a} — {counts.b} {opponentType === "ai" ? "Computer" : "Player 2"}
            </p>
            <button type="button" className="tt-new-game tt-winbanner-btn" onClick={() => handleNewGame()}>
              New Game
            </button>
            <button type="button" className="tt-winbanner-dismiss" onClick={() => setBannerDismissed(true)}>
              View board
            </button>
          </div>
        </div>
      )}
      </div>

      {!started && (
        <div className="tt-start-veil">
          <div className="tt-start">
            <img className="tt-start-logo" src={titleLogo} alt="Clash of Beasts" />
            <button type="button" className="tt-start-btn" onClick={handleStart} autoFocus>
              Press Start
            </button>
            <div className="tt-start-sound">
              <label>
                <input type="checkbox" checked={audio.music} onChange={toggleMusic} />
                Music
              </label>
              <label>
                <input type="checkbox" checked={audio.sfx} onChange={toggleSfx} />
                Effects
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
