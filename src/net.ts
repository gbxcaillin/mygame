// Thin client for the multiplayer relay (server/relay.js): host or join a
// room by code, then exchange small JSON payloads with the one peer. All
// game logic stays in App.tsx — this only moves messages.

const DEFAULT_RELAY = "wss://play.gbxps.com";

function relayUrl(): string {
  try {
    const override = new URLSearchParams(window.location.search).get("relay");
    if (override) return override;
  } catch {
    /* ignore */
  }
  return DEFAULT_RELAY;
}

/** The HTTP(S) base for the collection API — the same host as the relay,
    with the ws/wss scheme swapped for http/https. Honors ?relay= too. */
export function apiBase(): string {
  return relayUrl().replace(/^ws(s?):\/\//, "http$1://");
}

export interface NetEvents {
  onHosted: (code: string) => void;
  onJoined: (code: string) => void;
  onPeerJoined: () => void;
  onData: (data: unknown) => void;
  onPeerLeft: () => void;
  onError: (reason: string) => void;
  /** socket closed or never connected (relay unreachable) */
  onClosed: () => void;
}

export class NetSession {
  private ws: WebSocket | null = null;
  private events: NetEvents;
  private closedByUs = false;

  constructor(events: NetEvents) {
    this.events = events;
  }

  private connect(onOpen: () => void) {
    const ws = new WebSocket(relayUrl());
    this.ws = ws;
    ws.onopen = onOpen;
    ws.onmessage = (e) => {
      let msg: { type?: string; code?: string; data?: unknown; reason?: string };
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "hosted" && msg.code) this.events.onHosted(msg.code);
      else if (msg.type === "joined" && msg.code) this.events.onJoined(msg.code);
      else if (msg.type === "peer-joined") this.events.onPeerJoined();
      else if (msg.type === "data") this.events.onData(msg.data);
      else if (msg.type === "peer-left") this.events.onPeerLeft();
      else if (msg.type === "error") this.events.onError(msg.reason ?? "unknown");
    };
    ws.onclose = () => {
      if (!this.closedByUs) this.events.onClosed();
    };
    ws.onerror = () => {
      /* onclose follows and reports */
    };
  }

  host() {
    this.connect(() => this.ws?.send(JSON.stringify({ type: "host" })));
  }

  join(code: string) {
    this.connect(() => this.ws?.send(JSON.stringify({ type: "join", code })));
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "data", data }));
    }
  }

  close() {
    this.closedByUs = true;
    this.ws?.close();
    this.ws = null;
  }
}
