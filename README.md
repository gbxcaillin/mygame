# Triple Triad

A browser implementation of the Triple Triad card mini-game, inspired by Final Fantasy VIII. Built with React + TypeScript + Vite.

## Rules implemented

- Core capture rule: place a card on the 3x3 board, higher touching ranks flip adjacent enemy cards.
- **Same**: 2+ touching ranks match exactly → capture all matched cards.
- **Plus**: 2+ pairs of touching ranks share a sum → capture all matched cards.
- **Combo**: cards captured via Same/Plus chain into further basic-rule captures.
- **Same Wall**: board edges count as rank-10 walls for Same matching.

Toggle rules from the panel below the board (changing a rule starts a new match). This is local hotseat play, so "Open" hands are always on — both players share one screen.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the game engine unit tests
npm run build    # type-check + production build
```

Game logic lives in `src/game/` (`engine.ts` is the pure rules engine, framework-agnostic and unit-tested independently of the UI).
