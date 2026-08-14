# Archived visuals

This folder holds the original artwork-based presentation that was stripped
back to plain code. The game logic (`src/game/engine.ts`, `ai.ts`, `cards.ts`,
`types.ts`) was **not** archived — it still lives in `src/` and is unchanged
except that `cards.ts` no longer loads card artwork.

## Contents

- `src/App.tsx`, `src/App.css` — the backdrop-art layout with responsive
  portrait/landscape alignment to the backdrop's built-in card slots.
- `src/index.css` — the old dark global theme.
- `src/game/*.css` — the ornate card / board / hand / modal / lightbox styling.
- `src/game/cards.ts` — the card set with `import.meta.glob` artwork loading.
- `src/assets/*.png` — backdrop images (portrait, 4:3, 16:9) and wireframes.
- `src/assets/cards/*.jpg` — the 60 creature card illustrations.

## Restoring

Copy any file back over its counterpart in `src/`. To bring the card
artwork back, restore `src/assets/cards/` and `archive/src/game/cards.ts`
(or re-add the `import.meta.glob` block and `image: imageFor(id)` field).
