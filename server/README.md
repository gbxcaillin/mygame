# Multiplayer relay + collection store — deploying to play.gbxps.com

The game itself stays on GitHub Pages. This folder is a small server that
does two things on one port:

1. **Match relay** — a WebSocket pipe that pairs two players into a room
   and forwards their moves (no game state on the server).
2. **Collection store** — an HTTP API backed by SQLite that holds each
   player's collection and decks, keyed by a claimed name (no passwords).

It rides on the same VPS as familyoffice, behind the same Caddy.

## One-time setup on the VPS

SSH in, then:

```bash
# 1. Get the game repo next to familyoffice
cd ~
git clone https://github.com/gbxcaillin/mygame.git

# 2. Add the relay to the familyoffice compose stack
cd familyoffice
```

Add this service to `docker-compose.yml` (same level as `app:` and
`caddy:` — it joins their network automatically). The named volume keeps
the collections database across rebuilds:

```yaml
  gamerelay:
    build: /root/mygame/server
    restart: unless-stopped
    volumes:
      - gamedata:/data
```

and declare the volume alongside the existing `volumes:` block at the
bottom of the file:

```yaml
volumes:
  gamedata:
```

Add this block to `deploy/Caddyfile`:

```
play.gbxps.com {
    reverse_proxy gamerelay:8787
}
```

## DNS (VentraIP VIPControl)

Add one record to the gbxps.com zone, same as office:

```
Type A    Host play    Points to <the VPS IP>    TTL default
```

## Start it

```bash
cd ~/familyoffice
docker compose up -d --build gamerelay
docker compose restart caddy   # pick up the new Caddyfile block
```

Caddy fetches the HTTPS certificate for play.gbxps.com automatically
(wait a minute after DNS propagates). Done — the game finds the relay
at `wss://play.gbxps.com` with no client configuration.

## Updating

The relay barely ever needs to change, but when it does:

```bash
cd ~/mygame && git pull
cd ~/familyoffice && docker compose up -d --build gamerelay
```

## Checking it works

`docker compose logs gamerelay` should show
`Court of Beasts relay + collection API listening on :8787`.

- Multiplayer: in the game, Opponent → Friend → Host game should show a
  4-letter room code within a second.
- Collections: `curl https://play.gbxps.com/health` returns `ok`; setting
  a name in the game and earning a card should then show
  "✓ Saved to server" in the Collection screen.

If the server is down, solo play is unaffected: "Friend (online)" mode
and cross-device sync need it, but collections still work locally on
each device and sync up when the server is next reachable.

## Note on the existing deployment

This server already ran as the match-only relay. Updating to this
version adds the SQLite collection store, so the first `docker compose
up -d --build gamerelay` after pulling must also add the `gamedata`
volume shown above — without it, collections would not survive a
rebuild.
