# Multiplayer relay — deploying to play.gbxps.com

The game itself stays on GitHub Pages. This folder is a tiny WebSocket
relay (~100 lines, no database, no accounts) that pairs two players into
a room and forwards their moves. It rides on the same VPS as
familyoffice, behind the same Caddy.

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
`caddy:` — it joins their network automatically):

```yaml
  gamerelay:
    build: /root/mygame/server
    restart: unless-stopped
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
`Court of Beasts relay listening on :8787`. In the game, Opponent →
Friend → Host game should show a 4-letter room code within a second.

If the relay is down, solo play is unaffected — only "Friend (online)"
mode needs it.
