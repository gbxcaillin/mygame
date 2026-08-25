import { useEffect, useMemo, useState } from "react";
import { Board } from "./game/Board";
import { Hand } from "./game/Hand";
import { CardLightbox } from "./game/CardLightbox";
import { TutorialModal } from "./game/TutorialModal";
import { createInitialState, placeCard } from "./game/engine";
import { dealHands, cloneHand, dealHandExcluding, dealDraftPool } from "./game/cards";
import { chooseAiMove, DIFFICULTY_LABELS } from "./game/ai";
import type { Difficulty } from "./game/ai";
import { DEFAULT_RULES } from "./game/types";
import type { Card, GameState, PlayerId, RuleSet } from "./game/types";
import titleLogo from "./assets/title.png";
import bgLandscape from "./assets/bg-landscape.png";
import bgPortrait from "./assets/bg-portrait.png";
import coinCrown from "./assets/coin-crown.png";
import coinShield from "./assets/coin-shield.png";
import {
  startMusic,
  getAudioSettings,
  playFlip,
  playWin,
  playLose,
  setMusicEnabled,
  setSfxEnabled,
  vibrate,
} from "./audio";
import "./App.css";

type OpponentType = "human" | "ai";
const AI_THINK_DELAY_MS = 1400;

// Chrome/Android fires this before showing its install banner; not yet in TS's DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function newGame(rules: RuleSet, chosenHandA?: Card[]): GameState {
  let handA: Card[];
  let handB: Card[];
  if (chosenHandA) {
    handA = cloneHand(chosenHandA);
    handB = dealHandExcluding(new Set(chosenHandA.map((c) => c.id)));
  } else {
    ({ handA, handB } = dealHands());
  }
  // Coin flip: randomize who moves first.
  const starter: PlayerId = Math.random() < 0.5 ? "A" : "B";
  return createInitialState(handA, handB, starter, rules);
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
  const [deckMode, setDeckMode] = useState<"random" | "select">("random");
  const [deckOpen, setDeckOpen] = useState(false);
  const [draftPool, setDraftPool] = useState<Card[]>([]);
  const [picked, setPicked] = useState<Card[]>([]);
  const [coin, setCoin] = useState<{ pending: GameState; phase: "ready" | "flipping" | "done" } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Capture the browser's install prompt so we can offer it from our own button.
  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Flip sound + haptics on capture; light haptic on a plain placement.
  useEffect(() => {
    if (!state.lastMove) return;
    if (state.lastMove.captured.length > 0) {
      playFlip();
      vibrate(35);
    } else {
      vibrate(12);
    }
  }, [state.lastMove]);

  // Win / lose stinger + haptics; reset the banner when a match ends/restarts.
  useEffect(() => {
    if (state.winner === "A") {
      playWin();
      vibrate([50, 40, 70]);
    } else if (state.winner === "B" || state.winner === "draw") {
      playLose();
      vibrate(160);
    }
    if (!state.winner) setBannerDismissed(false);
  }, [state.winner]);

  useEffect(() => {
    if (!started || coin || opponentType !== "ai" || state.turn !== "B" || state.winner) {
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
  }, [state, opponentType, difficulty, started, coin]);

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

  function commitMatch(pending: GameState) {
    setState(pending);
    setSelectedCard(null);
    setBannerDismissed(false);
  }

  // Deal a new match. withCoin opens the interactive coin toss (which
  // commits the match when the flip lands); otherwise commit immediately.
  function startGame(chosenHandA?: Card[], nextRules: RuleSet = rules, withCoin = true) {
    const pending = newGame(nextRules, chosenHandA);
    if (withCoin) setCoin({ pending, phase: "ready" });
    else commitMatch(pending);
  }

  // Tap the coin to flip: spin, reveal who goes first, then start the match.
  function flipCoin() {
    if (!coin || coin.phase !== "ready") return;
    const pending = coin.pending;
    vibrate(25);
    setCoin({ pending, phase: "flipping" });
    window.setTimeout(() => setCoin((c) => (c ? { ...c, phase: "done" } : c)), 1500);
    window.setTimeout(() => {
      commitMatch(pending);
      setCoin(null);
      vibrate(pending.turn === "A" ? [40, 40, 60] : 90);
    }, 2500);
  }

  // Select mode: draft your 5 from a spread of 10 pyramid-weighted cards.
  function openDraft() {
    setDraftPool(dealDraftPool(10));
    setPicked([]);
    setDeckOpen(true);
  }

  // "New Game": draft in Select mode, else deal a fresh random game.
  function handleNewGame() {
    if (deckMode === "select") openDraft();
    else startGame();
  }

  function toggleRule(key: keyof RuleSet) {
    const nextRules = { ...rules, [key]: !rules[key] };
    setRules(nextRules);
    startGame(undefined, nextRules, false); // rule tweaks re-deal without the coin ceremony
  }

  function togglePick(card: Card) {
    setPicked((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev.filter((c) => c.id !== card.id);
      if (prev.length >= 5) return prev;
      return [...prev, card];
    });
  }

  function randomFill() {
    setPicked([...draftPool].sort(() => Math.random() - 0.5).slice(0, 5));
  }

  function confirmDeck() {
    if (picked.length !== 5) return;
    setDeckOpen(false);
    startGame(picked);
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

  // A captured prompt can only be shown once; clear it either way afterwards.
  async function handleInstall() {
    if (!installPrompt) return;
    const prompt = installPrompt;
    setInstallPrompt(null);
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
  }

  // Press Start: a direct user gesture that reliably kicks off music.
  function handleStart() {
    startMusic();
    setStarted(true);
    if (deckMode === "select") openDraft();
    else startGame();
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

  const coinStarter = coin?.pending.turn ?? "A";
  const coinResult =
    coinStarter === "A"
      ? opponentType === "ai"
        ? "You go first!"
        : "Player 1 goes first!"
      : opponentType === "ai"
        ? "Computer goes first!"
        : "Player 2 goes first!";

  return (
    <>
      <picture>
        <source srcSet={bgPortrait} media="(max-aspect-ratio: 7/10)" />
        <img src={bgLandscape} className="tt-backdrop" alt="" aria-hidden="true" />
      </picture>
      <div className="tt-flame tt-flame-left" aria-hidden="true" />
      <div className="tt-flame tt-flame-right" aria-hidden="true" />

      <div className="tt-app">
      <h1 className="tt-title">
        <img src={titleLogo} alt="Court of Beasts" />
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
            justPlaced={state.lastMove?.cellIndex ?? null}
            placeNonce={state.board.reduce((n, c) => n + (c ? 1 : 0), 0)}
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

          <label className="tt-field">
            Deck
            <select value={deckMode} onChange={(e) => setDeckMode(e.target.value as "random" | "select")}>
              <option value="random">Random</option>
              <option value="select">Select</option>
            </select>
          </label>
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
            <img className="tt-start-logo" src={titleLogo} alt="Court of Beasts" />
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
            {installPrompt && (
              <button type="button" className="tt-install-btn" onClick={handleInstall}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v10.6l-3.8-3.8-1.4 1.4L12 17.4l5.2-5.2-1.4-1.4-3.8 3.8V3h-2z" />
                  <path d="M5 19h14v2H5z" />
                </svg>
                Install App
              </button>
            )}
          </div>
        </div>
      )}

      {coin && (
        <div className="tt-coin-veil">
          <div className="tt-coin-stage">
            <button
              type="button"
              className={`tt-coin ${coin.phase === "ready" ? "ready" : "spun"} ${coinStarter === "A" ? "land-a" : "land-b"}`}
              onClick={flipCoin}
              aria-label="Flip the coin to decide who goes first"
            >
              <span className="tt-coin-face tt-coin-front">
                <img className="tt-coin-img" src={coinCrown} alt="" aria-hidden="true" />
              </span>
              <span className="tt-coin-face tt-coin-back">
                <img className="tt-coin-img" src={coinShield} alt="" aria-hidden="true" />
              </span>
            </button>
            <p className="tt-coin-caption">
              {coin.phase === "ready"
                ? "Tap the coin to flip"
                : coin.phase === "done"
                  ? coinResult
                  : "Flipping…"}
            </p>
          </div>
        </div>
      )}

      {deckOpen && (
        <div className="tt-deck-veil">
          <div className="tt-deck">
            <div className="tt-deck-head">
              <h2>
                Pick 5 of these 10
                <span className="tt-deck-hint"> · tap the 🔍 to enlarge</span>
              </h2>
              <span className="tt-deck-count">{picked.length} / 5</span>
            </div>
            <div className="tt-deck-grid tt-deck-draft">
              {draftPool.map((card) => {
                const sel = picked.some((c) => c.id === card.id);
                const maxed = !sel && picked.length >= 5;
                return (
                  <div
                    key={card.id}
                    className={`tt-deck-card ${sel ? "sel" : ""} ${maxed ? "maxed" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={sel}
                    aria-label={`${card.name}${sel ? ", selected" : ""}`}
                    onClick={() => togglePick(card)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        togglePick(card);
                      }
                    }}
                  >
                    {card.image ? (
                      <img src={card.image} alt={card.name} draggable={false} />
                    ) : (
                      <span className="tt-deck-name">{card.name}</span>
                    )}
                    {sel && <span className="tt-deck-tick" aria-hidden="true">✓</span>}
                    <button
                      type="button"
                      className="tt-deck-zoom"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspecting({ card });
                      }}
                      aria-label={`Enlarge ${card.name}`}
                      title="Enlarge"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="10" cy="10" r="6" />
                        <line x1="14.5" y1="14.5" x2="20" y2="20" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="tt-deck-actions">
              <button type="button" className="tt-new-game" onClick={randomFill}>
                Random
              </button>
              <button
                type="button"
                className="tt-new-game tt-deck-start"
                onClick={confirmDeck}
                disabled={picked.length !== 5}
              >
                Start Battle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox last, at root level, so it sits above every overlay
          (the deck picker, etc.) — it must not be trapped inside .tt-app. */}
      {inspecting && (
        <CardLightbox card={inspecting.card} owner={inspecting.owner} onClose={() => setInspecting(null)} />
      )}
    </>
  );
}

export default App;
