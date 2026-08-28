import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "./game/Board";
import { Hand } from "./game/Hand";
import { CardLightbox } from "./game/CardLightbox";
import { TutorialModal } from "./game/TutorialModal";
import { createInitialState, placeCard } from "./game/engine";
import { dealHands, cloneHand, dealHandExcluding, dealDraftPool, CARD_POOL } from "./game/cards";
import { NetSession } from "./net";
import { CollectionPanel } from "./game/CollectionPanel";
import { activeDeckCards, earnReward } from "./game/collection";
import { chooseAiMove, DIFFICULTY_LABELS } from "./game/ai";
import type { Difficulty } from "./game/ai";
import { DEFAULT_RULES } from "./game/types";
import type { Card, GameState, PlayerId, RuleSet } from "./game/types";
import titleLogo from "./assets/title.png";
import bgLandscape from "./assets/bg-landscape.jpg";
import bgSquare from "./assets/bg-square.jpg";
import bg4x3 from "./assets/bg-4x3.jpg";
import bgPortrait from "./assets/bg-portrait.jpg";
import coinCrown from "./assets/coin-crown.png";
import coinShield from "./assets/coin-shield.png";
import introMp4 from "./assets/intro.mp4";
import introWebm from "./assets/intro.webm";
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

type OpponentType = "human" | "ai" | "online";
const AI_THINK_DELAY_MS = 1400;

interface OnlineState {
  role: "host" | "guest" | null;
  stage: "menu" | "connecting" | "hosting" | "connected";
  code: string;
  error: string | null;
  peerLeft: boolean;
}

/** Messages exchanged between the two game clients (via the relay). */
type NetData =
  | { t: "setup"; a: string[]; b: string[]; starter: PlayerId; rules: RuleSet }
  | { t: "flip" }
  | { t: "move"; cell: number; cardId: string };

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
  const [deckMode, setDeckMode] = useState<"random" | "select" | "deck">("select");
  const [deckOpen, setDeckOpen] = useState(false);
  const [draftPool, setDraftPool] = useState<Card[]>([]);
  const [picked, setPicked] = useState<Card[]>([]);
  const [coin, setCoin] = useState<{ pending: GameState; phase: "ready" | "flipping" | "done" } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [intro, setIntro] = useState(true);
  const [online, setOnline] = useState<OnlineState | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [reward, setReward] = useState<{ card: Card; isNew: boolean } | null>(null);
  const [, setColVersion] = useState(0); // bumped when the collection changes

  // Net callbacks are registered once and outlive renders, so anything they
  // read must come through refs, and anything they write must use setters.
  const netRef = useRef<NetSession | null>(null);
  const coinRef = useRef(coin);
  const rulesRef = useRef(rules);
  const onlineRef = useRef(online);
  const opponentTypeRef = useRef(opponentType);
  const difficultyRef = useRef(difficulty);
  useEffect(() => {
    coinRef.current = coin;
  }, [coin]);
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);
  useEffect(() => {
    onlineRef.current = online;
  }, [online]);
  useEffect(() => {
    opponentTypeRef.current = opponentType;
  }, [opponentType]);
  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  const myPlayer: PlayerId = online?.role === "guest" ? "B" : "A";

  // If the intro can't load or decode (unsupported codec, offline cache
  // miss), skip it rather than sit on a black screen. Source-element
  // failures don't bubble to the video's onError, hence the watchdog.
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => {
      const v = document.querySelector<HTMLVideoElement>(".tt-intro-video");
      if (!v || v.readyState < 2) setIntro(false);
    }, 2500);
    return () => clearTimeout(t);
  }, [intro]);

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
  // "Winning" is perspective-aware: online guests play as B.
  useEffect(() => {
    const mine: PlayerId = onlineRef.current?.role === "guest" ? "B" : "A";
    if (state.winner === mine) {
      playWin();
      vibrate([50, 40, 70]);
      if (opponentTypeRef.current === "ai" && !onlineRef.current) {
        setReward(earnReward(difficultyRef.current));
        setColVersion((v) => v + 1);
      }
    } else if (state.winner) {
      playLose();
      vibrate(160);
    }
    if (!state.winner) {
      setBannerDismissed(false);
      setReward(null);
    }
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
    if (online && state.turn !== myPlayer) return;
    let next: GameState;
    try {
      next = placeCard(state, index, selectedCard);
    } catch {
      return; // occupied cell / stale click
    }
    if (online) {
      netRef.current?.send({ t: "move", cell: index, cardId: selectedCard.id } satisfies NetData);
    }
    setState(next);
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

  // Coin animation + commit; safe to call from net callbacks (reads the ref).
  function performFlip() {
    const c = coinRef.current;
    if (!c || c.phase !== "ready") return;
    const pending = c.pending;
    vibrate(25);
    setCoin({ pending, phase: "flipping" });
    window.setTimeout(() => setCoin((cc) => (cc ? { ...cc, phase: "done" } : cc)), 1500);
    window.setTimeout(() => {
      commitMatch(pending);
      setCoin(null);
      vibrate(pending.turn === "A" ? [40, 40, 60] : 90);
    }, 2500);
  }

  // Tap the coin to flip: spin, reveal who goes first, then start the match.
  // Online, only the host flips; the guest's coin mirrors it.
  function flipCoin() {
    if (online?.role === "guest") return;
    if (online) netRef.current?.send({ t: "flip" } satisfies NetData);
    performFlip();
  }

  // ── Online play (see server/relay.js and src/net.ts) ──

  // Host deals both hands, picks the starter, and mirrors it to the guest.
  function hostDeal(nextRules?: RuleSet) {
    const r = nextRules ?? rulesRef.current;
    const pending = newGame(r);
    netRef.current?.send({
      t: "setup",
      a: pending.hands.A.map((c) => c.id),
      b: pending.hands.B.map((c) => c.id),
      starter: pending.turn,
      rules: r,
    } satisfies NetData);
    setSelectedCard(null);
    setCoin({ pending, phase: "ready" });
  }

  function handleNetData(d: unknown) {
    const msg = d as NetData;
    if (!msg || typeof msg !== "object") return;
    if (msg.t === "setup") {
      const byId = new Map(CARD_POOL.map((c) => [c.id, c]));
      const pick = (ids: string[]) =>
        ids.flatMap((id) => {
          const c = byId.get(id);
          return c ? [{ ...c, ranks: { ...c.ranks } }] : [];
        });
      const handA = pick(msg.a);
      const handB = pick(msg.b);
      if (handA.length !== 5 || handB.length !== 5) return; // version mismatch
      setRules(msg.rules);
      setDeckOpen(false);
      setSelectedCard(null);
      setCoin({ pending: createInitialState(handA, handB, msg.starter, msg.rules), phase: "ready" });
    } else if (msg.t === "flip") {
      performFlip();
    } else if (msg.t === "move") {
      setState((prev) => {
        if (prev.winner) return prev;
        const card = prev.hands[prev.turn].find((c) => c.id === msg.cardId);
        if (!card || prev.board[msg.cell] !== null) return prev;
        return placeCard(prev, msg.cell, card);
      });
      setSelectedCard(null);
    }
  }

  function makeNet(): NetSession {
    netRef.current?.close();
    const net = new NetSession({
      onHosted: (code) => setOnline((o) => (o ? { ...o, stage: "hosting", code } : o)),
      onJoined: (code) => setOnline((o) => (o ? { ...o, stage: "connected", code } : o)),
      onPeerJoined: () => {
        setOnline((o) => (o ? { ...o, stage: "connected" } : o));
        hostDeal();
      },
      onData: handleNetData,
      onPeerLeft: () => setOnline((o) => (o ? { ...o, peerLeft: true } : o)),
      onError: (reason) =>
        setOnline((o) =>
          o
            ? {
                ...o,
                stage: "menu",
                error:
                  reason === "room-not-found"
                    ? "No game with that code"
                    : reason === "room-full"
                      ? "That game already has two players"
                      : "Connection error",
              }
            : o
        ),
      onClosed: () =>
        setOnline((o) =>
          o && !o.peerLeft ? { ...o, stage: "menu", error: "Can't reach the game server" } : o
        ),
    });
    netRef.current = net;
    return net;
  }

  function startHost() {
    setOnline({ role: "host", stage: "connecting", code: "", error: null, peerLeft: false });
    makeNet().host();
  }

  function startJoin() {
    setOnline({ role: "guest", stage: "connecting", code: "", error: null, peerLeft: false });
    makeNet().join(joinCode);
  }

  function leaveOnline(nextOpponent: OpponentType = "ai") {
    netRef.current?.close();
    netRef.current = null;
    setOnline(null);
    setJoinCode("");
    setOpponentType(nextOpponent);
    startGame(undefined, rules, false); // fresh local board
  }

  function handleOpponentChange(value: OpponentType) {
    if (!started) {
      // start screen: just record the choice; Press Start opens the right flow
      setOpponentType(value);
      return;
    }
    if (value === "online") {
      setOpponentType("online");
      setDeckOpen(false);
      setOnline({ role: null, stage: "menu", code: "", error: null, peerLeft: false });
    } else if (online) {
      leaveOnline(value);
    } else {
      setOpponentType(value);
    }
  }

  // Select mode: draft your 5 from a spread of 10 pyramid-weighted cards.
  function openDraft() {
    setDraftPool(dealDraftPool(10));
    setPicked([]);
    setDeckOpen(true);
  }

  // "New Game": draft in Select mode, saved deck in My Deck mode, else random.
  function handleNewGame() {
    if (deckMode === "select") openDraft();
    else if (deckMode === "deck") startGame(activeDeckCards() ?? undefined);
    else startGame();
  }

  function toggleRule(key: keyof RuleSet) {
    if (online?.role === "guest") return; // the host owns the rules online
    const nextRules = { ...rules, [key]: !rules[key] };
    setRules(nextRules);
    if (!started) return; // start screen: record the choice, Start deals with it
    if (online) hostDeal(nextRules);
    else startGame(undefined, nextRules, false); // rule tweaks re-deal without the coin ceremony
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
  // Routes by the opponent chosen on the start screen.
  function handleStart() {
    startMusic();
    setStarted(true);
    if (opponentType === "online") {
      setOnline({ role: null, stage: "menu", code: "", error: null, peerLeft: false });
    } else if (deckMode === "select") {
      openDraft();
    } else if (deckMode === "deck") {
      startGame(activeDeckCards() ?? undefined);
    } else {
      startGame();
    }
  }

  const myDeck = activeDeckCards();

  const player2Label = online ? "Friend" : opponentType === "ai" ? "Computer" : "Player 2";
  const winnerLabel = online
    ? state.winner === myPlayer
      ? "You win!"
      : state.winner === "draw"
        ? "Draw!"
        : "Friend wins!"
    : state.winner === "A"
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
      : online
        ? state.turn === myPlayer
          ? "Your turn"
          : "Friend's turn"
        : `${state.turn === "A" ? "Player 1" : player2Label}'s turn`;

  const meForBanner: PlayerId = online ? myPlayer : "A";
  const bannerKind =
    state.winner === "draw" ? "draw" : state.winner === meForBanner ? "win" : "lose";
  const bannerTitle =
    state.winner === "draw"
      ? "Draw"
      : opponentType === "ai" || online
        ? state.winner === meForBanner
          ? "You Won!"
          : "You Lost…"
        : state.winner === "A"
          ? "Player 1 Wins!"
          : "Player 2 Wins!";
  const showBanner = !!state.winner && !bannerDismissed;

  const coinStarter = coin?.pending.turn ?? "A";
  const coinResult = online
    ? coinStarter === myPlayer
      ? "You go first!"
      : "Friend goes first!"
    : coinStarter === "A"
      ? opponentType === "ai"
        ? "You go first!"
        : "Player 1 goes first!"
      : opponentType === "ai"
        ? "Computer goes first!"
        : "Player 2 goes first!";

  // Online, each device shows its own hand at the bottom (host = blue A,
  // guest = red B); locally the layout stays A-bottom as always.
  const bottomPlayer: PlayerId = online ? myPlayer : "A";
  const topPlayer: PlayerId = bottomPlayer === "A" ? "B" : "A";

  return (
    <>
      <picture>
        {/* first matching source wins: tall -> portrait art, squarish -> clean statue art
            (no baked sockets, since the UI moves in that band), 4:3 -> dressed 4:3 art,
            wider -> 16:9 art */}
        <source srcSet={bgPortrait} media="(max-aspect-ratio: 7/10)" />
        <source srcSet={bgSquare} media="(max-aspect-ratio: 11/10)" />
        <source srcSet={bg4x3} media="(max-aspect-ratio: 3/2)" />
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
            player={topPlayer}
            cards={state.hands[topPlayer]}
            isActive={!online && state.turn === "B" && !state.winner && opponentType === "human"}
            selectedCardId={selectedCard?.id ?? null}
            onSelect={handleSelect}
            onInspect={(card) => setInspecting({ card, owner: topPlayer })}
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
            player={bottomPlayer}
            cards={state.hands[bottomPlayer]}
            isActive={state.turn === bottomPlayer && !state.winner}
            selectedCardId={selectedCard?.id ?? null}
            onSelect={handleSelect}
            onInspect={(card) => setInspecting({ card, owner: bottomPlayer })}
            label={online ? "You" : "Player 1"}
          />
        </section>
      </div>

      <div className="tt-panel">
      <div className="tt-topbar">
        <button
          type="button"
          className="tt-new-game"
          onClick={() => (online ? online.role === "host" && hostDeal() : handleNewGame())}
          disabled={online?.role === "guest"}
          title={online?.role === "guest" ? "The host deals" : undefined}
        >
          New Game
        </button>
        <div className={`tt-status ${!state.winner ? `turn-${state.turn}` : ""}`}>
          <span className="tt-status-text">{status}</span>
          <span className="tt-score">
            <span className="score-a">{online ? (myPlayer === "A" ? "You" : "Friend") : "P1"}: {counts.a}</span>
            <span className="score-b">
              {online ? (myPlayer === "B" ? "You" : "Friend") : opponentType === "ai" ? "CPU" : "P2"}: {counts.b}
            </span>
          </span>
        </div>
      </div>

      <div className="tt-bottombar">
        <div className="tt-controls">
          <button type="button" className="tt-help-btn" onClick={() => setTutorialOpen(true)}>
            How to play
          </button>
          <button type="button" className="tt-help-btn" onClick={() => setCollectionOpen(true)}>
            Collection
          </button>

          <label className="tt-field">
            Opponent
            <select value={opponentType} onChange={(e) => handleOpponentChange(e.target.value as OpponentType)}>
              <option value="ai">Computer</option>
              <option value="human">Human</option>
              <option value="online">Friend (online)</option>
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

          {!online && (
            <label className="tt-field">
              Deck
              <select value={deckMode} onChange={(e) => setDeckMode(e.target.value as "random" | "select" | "deck")}>
                <option value="random">Random</option>
                <option value="select">Select</option>
                {myDeck && <option value="deck">My Deck</option>}
              </select>
            </label>
          )}
        </div>

        <fieldset className="tt-rules">
          <legend>Rules</legend>
          <label>
            <input type="checkbox" checked={rules.same} disabled={online?.role === "guest"} onChange={() => toggleRule("same")} />
            Same
          </label>
          <label>
            <input type="checkbox" checked={rules.plus} disabled={online?.role === "guest"} onChange={() => toggleRule("plus")} />
            Plus
          </label>
          <label>
            <input type="checkbox" checked={rules.combo} disabled={online?.role === "guest"} onChange={() => toggleRule("combo")} />
            Combo
          </label>
          <label>
            <input type="checkbox" checked={rules.sameWall} disabled={online?.role === "guest"} onChange={() => toggleRule("sameWall")} />
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
            {reward && bannerKind === "win" && (
              <div className="tt-reward">
                <p className="tt-reward-label">{reward.isNew ? "New card won!" : "Card won!"}</p>
                {reward.card.image && <img className="tt-reward-card" src={reward.card.image} alt={reward.card.name} />}
                <p className="tt-reward-name">
                  {reward.card.name}
                  {reward.isNew ? " — added to your collection" : " — another copy"}
                </p>
              </div>
            )}
            <p className="tt-winbanner-score">
              {online
                ? `You ${myPlayer === "A" ? counts.a : counts.b} — ${myPlayer === "A" ? counts.b : counts.a} Friend`
                : `Player 1 ${counts.a} — ${counts.b} ${opponentType === "ai" ? "Computer" : "Player 2"}`}
            </p>
            {online?.role !== "guest" ? (
              <button
                type="button"
                className="tt-new-game tt-winbanner-btn"
                onClick={() => (online ? hostDeal() : handleNewGame())}
              >
                New Game
              </button>
            ) : (
              <p className="tt-winbanner-score">Waiting for the host to deal again…</p>
            )}
            <button type="button" className="tt-winbanner-dismiss" onClick={() => setBannerDismissed(true)}>
              View board
            </button>
          </div>
        </div>
      )}
      </div>

      {intro && !started && (
        <div className="tt-intro" onClick={() => setIntro(false)} role="button" aria-label="Skip intro">
          {/* no onError here: a rejected <source> fires an error that React's
              capture-phase listener would treat as a video failure, killing the
              intro before the next source loads. The readyState watchdog above
              handles genuine can't-play cases. */}
          <video
            className="tt-intro-video"
            autoPlay
            muted
            playsInline
            onEnded={() => setIntro(false)}
          >
            {/* codec-specific types let H.264-less browsers skip straight to the webm */}
            <source src={introMp4} type='video/mp4; codecs="avc1.640028"' />
            <source src={introWebm} type='video/webm; codecs="vp9"' />
          </video>
          <span className="tt-intro-skip">Tap to skip</span>
        </div>
      )}

      {!started && (
        <div className="tt-start-veil">
          <div className="tt-start">
            <img className="tt-start-logo" src={titleLogo} alt="Court of Beasts" />

            <div className="tt-start-options">
              <div className="tt-start-selects">
                <label className="tt-field">
                  Opponent
                  <select value={opponentType} onChange={(e) => handleOpponentChange(e.target.value as OpponentType)}>
                    <option value="ai">Computer</option>
                    <option value="human">Human</option>
                    <option value="online">Friend (online)</option>
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
                {opponentType !== "online" && (
                  <label className="tt-field">
                    Deck
                    <select value={deckMode} onChange={(e) => setDeckMode(e.target.value as "random" | "select" | "deck")}>
                      <option value="random">Random</option>
                      <option value="select">Select</option>
                      {myDeck && <option value="deck">My Deck</option>}
                    </select>
                  </label>
                )}
              </div>
              <fieldset className="tt-rules tt-start-rules">
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
            </div>

            <button type="button" className="tt-start-btn" onClick={handleStart} autoFocus>
              Press Start
            </button>
            <button type="button" className="tt-new-game tt-start-collection" onClick={() => setCollectionOpen(true)}>
              Collection
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
                ? online?.role === "guest"
                  ? "Waiting for the host to flip…"
                  : "Tap the coin to flip"
                : coin.phase === "done"
                  ? coinResult
                  : "Flipping…"}
            </p>
          </div>
        </div>
      )}

      {online && (online.stage !== "connected" || online.error) && !online.peerLeft && (
        <div className="tt-lobby-veil">
          <div className="tt-lobby">
            <h2>Play a Friend</h2>
            {online.error && <p className="tt-lobby-error">{online.error}</p>}
            {online.stage === "menu" && (
              <>
                <button type="button" className="tt-new-game tt-lobby-btn" onClick={startHost}>
                  Host a game
                </button>
                <div className="tt-lobby-divider">or join with a code</div>
                <div className="tt-lobby-join">
                  <input
                    value={joinCode}
                    maxLength={4}
                    placeholder="CODE"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    aria-label="Room code"
                  />
                  <button
                    type="button"
                    className="tt-new-game tt-lobby-btn"
                    disabled={joinCode.length !== 4}
                    onClick={startJoin}
                  >
                    Join
                  </button>
                </div>
              </>
            )}
            {online.stage === "connecting" && <p className="tt-lobby-wait">Connecting…</p>}
            {online.stage === "hosting" && (
              <>
                <p className="tt-lobby-wait">Room code</p>
                <div className="tt-lobby-code">{online.code}</div>
                <p className="tt-lobby-hint">
                  Your friend opens the game, picks Opponent → Friend (online), and enters this code.
                </p>
              </>
            )}
            <button type="button" className="tt-lobby-leave" onClick={() => leaveOnline()}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {online?.peerLeft && (
        <div className="tt-lobby-veil">
          <div className="tt-lobby">
            <h2>Friend disconnected</h2>
            <p className="tt-lobby-hint">The connection to your friend was lost.</p>
            <button type="button" className="tt-new-game tt-lobby-btn" onClick={() => leaveOnline()}>
              Back to solo play
            </button>
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

      {/* Root-level overlays: rendered outside .tt-app so their z-index isn't
          trapped inside its stacking context. */}
      {collectionOpen && (
        <CollectionPanel
          onClose={() => setCollectionOpen(false)}
          onChanged={() => setColVersion((v) => v + 1)}
        />
      )}

      {/* Lightbox last so it sits above every overlay. */}
      {inspecting && (
        <CardLightbox card={inspecting.card} owner={inspecting.owner} onClose={() => setInspecting(null)} />
      )}
    </>
  );
}

export default App;
