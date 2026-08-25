#!/usr/bin/env python3
"""Generates the battle-theme background loop (src/assets/sounds/music.wav).

Pure-stdlib WAV synthesis: a fast minor-key battle loop in the spirit of
classic JRPG encounter themes. 158 BPM, 16 bars, seamless loop (note tails
wrap around to the start of the buffer).

Layers:
  - drums: kick (pitch-swept sine), snare (noise + tone), closed hats
  - bass:  driving eighth-note saw ostinato following the chords
  - lead:  square-wave melody with vibrato
  - stab:  offbeat chord stabs for urgency

Run from the repo root:  python3 scripts/gen_battle_music.py
"""

import math
import random
import struct
import wave

SR = 22050
BPM = 158
EIGHTH = 60.0 / BPM / 2.0  # duration of one eighth note
BARS = 16
SLOTS_PER_BAR = 8  # eighth notes per 4/4 bar

N = int(round(BARS * SLOTS_PER_BAR * EIGHTH * SR))
buf = [0.0] * N

random.seed(1177)

# ---------------------------------------------------------------- pitches

SEMITONES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5,
             "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def freq(name: str) -> float:
    """Note name like 'A4' or 'G#5' -> frequency in Hz (A4 = 440)."""
    pitch, octave = name[:-1], int(name[-1])
    midi = 12 * (octave + 1) + SEMITONES[pitch]
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


def add(start_sec: float, samples: list[float], gain: float) -> None:
    """Mix samples into the loop buffer, wrapping past the end so the
    final bar's tails ring into the top of the loop (seamless join)."""
    i0 = int(round(start_sec * SR))
    for j, s in enumerate(samples):
        buf[(i0 + j) % N] += s * gain


# ------------------------------------------------------------ instruments

def saw_note(f: float, dur: float, sustain: float = 0.6) -> list[float]:
    """Band-limited-ish saw (6 harmonics) with a plucky envelope."""
    n = int(dur * SR)
    out = []
    for i in range(n):
        t = i / SR
        ph = 2 * math.pi * f * t
        s = sum(math.sin(k * ph) / k for k in range(1, 7))
        # fast attack, exponential decay to a sustain floor, short release
        env = min(1.0, t / 0.004) * (sustain + (1 - sustain) * math.exp(-t * 14))
        rel = min(1.0, (dur - t) / 0.02)
        out.append(s * env * rel)
    return out


def square_note(f: float, dur: float, vib: float = 6.0) -> list[float]:
    """Odd-harmonic square lead with light vibrato."""
    n = int(dur * SR)
    out = []
    for i in range(n):
        t = i / SR
        vibr = vib * math.sin(2 * math.pi * 5.6 * t) * min(1.0, t / 0.09)
        ph = 2 * math.pi * (f * t) + 2 * math.pi * vibr * t / max(f, 1) * f * 0.002
        ph += vibr * 0.004
        s = sum(math.sin(k * ph) / k for k in (1, 3, 5, 7, 9))
        env = min(1.0, t / 0.006) * (0.55 + 0.45 * math.exp(-t * 6))
        rel = min(1.0, (dur - t) / 0.025)
        out.append(s * env * rel)
    return out


def stab_chord(freqs: list[float], dur: float) -> list[float]:
    """Short bright chord stab."""
    n = int(dur * SR)
    out = []
    for i in range(n):
        t = i / SR
        s = 0.0
        for f in freqs:
            ph = 2 * math.pi * f * t
            s += math.sin(ph) + 0.5 * math.sin(2 * ph) + 0.25 * math.sin(3 * ph)
        env = min(1.0, t / 0.003) * math.exp(-t * 18)
        out.append(s / len(freqs) * env)
    return out


def kick(dur: float = 0.14) -> list[float]:
    n = int(dur * SR)
    out = []
    ph = 0.0
    for i in range(n):
        t = i / SR
        f = 40 + 110 * math.exp(-t * 38)  # 150 Hz thump sweeping to 40 Hz
        ph += 2 * math.pi * f / SR
        env = math.exp(-t * 26)
        out.append(math.sin(ph) * env)
    return out


def snare(dur: float = 0.16) -> list[float]:
    n = int(dur * SR)
    out = []
    prev = 0.0
    for i in range(n):
        t = i / SR
        noise = random.uniform(-1, 1)
        crisp = noise - prev  # first difference = cheap high-pass
        prev = noise
        body = 0.5 * math.sin(2 * math.pi * 186 * t) * math.exp(-t * 40)
        env = math.exp(-t * 22)
        out.append((0.8 * crisp + body) * env)
    return out


def hat(dur: float = 0.045) -> list[float]:
    n = int(dur * SR)
    out = []
    prev = 0.0
    for i in range(n):
        t = i / SR
        noise = random.uniform(-1, 1)
        crisp = noise - prev
        prev = noise
        out.append(crisp * math.exp(-t * 70))
    return out


# ------------------------------------------------------------- the score

# Andalusian descent in A minor for the A section, darker turn for the B.
# One chord per bar: (bass root, chord tones for stabs)
CH = {
    "Am": ("A2", ["A3", "C4", "E4"]),
    "G":  ("G2", ["G3", "B3", "D4"]),
    "F":  ("F2", ["F3", "A3", "C4"]),
    "E":  ("E2", ["E3", "G#3", "B3"]),
    "Dm": ("D2", ["D3", "F3", "A3"]),
    "C":  ("C3", ["C3", "E3", "G3"]),
}

PROGRESSION = ["Am", "G", "F", "E", "Am", "G", "F", "E",
               "Dm", "C", "F", "E", "Am", "F", "E", "E"]

# Lead melody: per bar, list of (note-or-None, length in eighths).
MELODY: list[list[tuple[str | None, float]]] = [
    # A section — charging downhill run
    [("A4", 1), ("C5", 1), ("E5", 1), ("A5", 2), ("G5", 1), ("E5", 2)],
    [("G5", 1), ("F5", 1), ("E5", 1), ("D5", 2), ("B4", 1), ("D5", 2)],
    [("F5", 1), ("E5", 1), ("D5", 1), ("C5", 2), ("A4", 1), ("C5", 2)],
    [("B4", 1), ("C5", 1), ("D5", 1), ("E5", 3), ("G#4", 1), ("B4", 1)],
    [("A5", 1), ("E5", 1), ("C5", 1), ("A4", 2), ("C5", 1), ("E5", 2)],
    [("B4", 1), ("D5", 1), ("G5", 1), ("B5", 2), ("A5", 1), ("G5", 2)],
    [("A5", 1), ("G5", 1), ("F5", 1), ("E5", 2), ("D5", 1), ("C5", 2)],
    [("B4", 2), ("E5", 2), ("G#5", 2), ("B5", 2)],
    # B section — tenser, winding back up to the loop point
    [("D5", 1), ("F5", 1), ("A5", 1), ("D5", 2), ("G5", 1), ("F5", 2)],
    [("C5", 1), ("E5", 1), ("G5", 1), ("E5", 2), ("D5", 1), ("C5", 2)],
    [("F5", 1), ("A5", 1), ("G5", 1), ("F5", 2), ("E5", 1), ("D5", 2)],
    [("E5", 1), ("D5", 1), ("B4", 1), ("G#4", 2), ("B4", 1), ("E5", 2)],
    [("A4", 1), ("B4", 1), ("C5", 1), ("E5", 1), ("D5", 1), ("C5", 1), ("B4", 1), ("C5", 1)],
    [("D5", 1), ("C5", 1), ("A4", 1), ("F5", 2), ("E5", 1), ("D5", 2)],
    [("C5", 1), ("B4", 1), ("A4", 1), ("G#4", 1), ("B4", 1), ("D5", 1), ("C5", 1), ("B4", 1)],
    [("E5", 2), ("B4", 2), ("G#4", 2), ("E4", 1), ("B4", 1)],
]

# Driving bass pattern over each bar (offsets in eighths from the root):
# root root 5th root | oct 5th root 5th  — relentless gallop.
BASS_PATTERN = [0, 0, 7, 0, 12, 7, 0, 7]

MIX = {"bass": 0.24, "lead": 0.20, "stab": 0.10,
       "kick": 0.48, "snare": 0.30, "hat": 0.085}

for bar, chord in enumerate(PROGRESSION):
    bar_t = bar * SLOTS_PER_BAR * EIGHTH
    root_name, stab_tones = CH[chord]
    root_f = freq(root_name)

    # bass gallop
    for slot, offset in enumerate(BASS_PATTERN):
        f = root_f * 2.0 ** (offset / 12.0)
        add(bar_t + slot * EIGHTH, saw_note(f, EIGHTH * 0.92), MIX["bass"])

    # offbeat stabs (the "and" of 1 and 3)
    for slot in (1, 5):
        add(bar_t + slot * EIGHTH,
            stab_chord([freq(n) for n in stab_tones], EIGHTH * 0.8), MIX["stab"])

    # drums
    kick_slots = [0, 4] if bar % 4 != 3 else [0, 3, 4]
    for slot in kick_slots:
        add(bar_t + slot * EIGHTH, kick(), MIX["kick"])
    for slot in (2, 6):
        add(bar_t + slot * EIGHTH, snare(), MIX["snare"])
    for slot in range(SLOTS_PER_BAR):
        accent = 1.0 if slot % 2 == 0 else 0.6
        add(bar_t + slot * EIGHTH, hat(), MIX["hat"] * accent)
    if bar % 8 == 7:  # snare roll into the next section
        for k in range(4):
            add(bar_t + (6 + k * 0.5) * EIGHTH, snare(0.09),
                MIX["snare"] * (0.5 + 0.14 * k))

    # melody
    slot = 0.0
    for note, length in MELODY[bar]:
        if note is not None:
            add(bar_t + slot * EIGHTH,
                square_note(freq(note), length * EIGHTH * 0.96), MIX["lead"])
        slot += length

# --------------------------------------------------------------- mastering

peak = max(abs(s) for s in buf)
norm = 0.92 / peak if peak > 0 else 1.0
frames = bytearray()
for s in buf:
    v = math.tanh(s * norm * 1.25) * 0.95  # gentle soft-clip glue
    frames += struct.pack("<h", int(max(-1.0, min(1.0, v)) * 32767))

out_path = "src/assets/sounds/music.wav"
with wave.open(out_path, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(bytes(frames))

print(f"wrote {out_path}: {N / SR:.2f}s, {len(frames) / 1024:.0f} KiB")
