# Friend Bot — test online play solo

`friend-bot.html` is a self-contained page: a stand-in opponent that joins a
game you host and plays with the real game AI, so you can test the online
Friend flow (collection draft, wager, dice, card transfer) without a second
device.

**Use:** open `friend-bot.html` in a browser. In the game, pick
Opponent → Friend (online) → Host a game, read the 4-letter code, enter it in
the bot, choose difficulty and whether it wagers, and Connect. Finish your own
draft in the game and the bot plays. It defaults to the live relay
(`wss://play.gbxps.com`); pass `?relay=ws://host:port` to point elsewhere.

**Rebuild** (after changing `bot.ts` or the card stats):

```bash
npx esbuild bot/bot.ts --bundle --format=iife --minify --outfile=/tmp/bot.js
# then inline /tmp/bot.js into bot/index.html in place of <script src="./bot.js">
```

`creatures.ts` is an image-free snapshot of the card stats (from
`src/game/cards.ts`) so the bundle stays tiny and plays with identical ranks.
The bot reuses the real `src/game/engine` and `src/game/ai` — no duplicated
game logic.
