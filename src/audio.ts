// Simple audio manager: looping background music + one-shot SFX, with
// independent music/effects toggles persisted to localStorage. Uses HTML
// Audio elements (decode-free WAV, low overhead).
import musicUrl from "./assets/sounds/music.wav";
import flipUrl from "./assets/sounds/flip.wav";
import winUrl from "./assets/sounds/win.wav";
import loseUrl from "./assets/sounds/lose.wav";

export interface AudioSettings {
  music: boolean;
  sfx: boolean;
}

const STORAGE_KEY = "cob-audio";

function loadSettings(): AudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { music: raw.music !== false, sfx: raw.sfx !== false };
  } catch {
    return { music: true, sfx: true };
  }
}

let settings = loadSettings();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

const music = new Audio(musicUrl);
music.loop = true;
music.volume = 0.45;
music.preload = "auto";

const SFX_VOLUME: Record<string, number> = { flip: 1.0, win: 0.85, lose: 0.85 };
const sfxUrls: Record<string, string> = { flip: flipUrl, win: winUrl, lose: loseUrl };

export function getAudioSettings(): AudioSettings {
  return { ...settings };
}

export function startMusic() {
  if (!settings.music) return;
  music.play().catch(() => {
    /* blocked until a user gesture — call from a click handler */
  });
}

export function setMusicEnabled(on: boolean) {
  settings.music = on;
  persist();
  if (on) startMusic();
  else music.pause();
}

export function setSfxEnabled(on: boolean) {
  settings.sfx = on;
  persist();
}

function playSfx(name: keyof typeof sfxUrls) {
  if (!settings.sfx) return;
  // Clone so rapid/overlapping plays don't cut each other off.
  const node = new Audio(sfxUrls[name]);
  node.volume = SFX_VOLUME[name] ?? 1;
  node.play().catch(() => {
    /* ignore */
  });
}

export function playFlip() {
  playSfx("flip");
}
export function playWin() {
  playSfx("win");
}
export function playLose() {
  playSfx("lose");
}

// Haptic feedback (mobile), gated on the Effects toggle.
export function vibrate(pattern: number | number[]) {
  if (!settings.sfx) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

// Browsers block audio until the first user gesture. Arm a one-time
// listener that starts the music once the player interacts.
let armed = false;
export function armAudio() {
  if (armed) return;
  armed = true;
  const start = () => {
    startMusic();
    window.removeEventListener("pointerdown", start);
    window.removeEventListener("keydown", start);
  };
  window.addEventListener("pointerdown", start);
  window.addEventListener("keydown", start);
}
