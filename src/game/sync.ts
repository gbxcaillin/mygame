// Server sync for the player collection.
//
// When a name is claimed, the server (server/store.js) becomes the primary
// store: the collection is pulled on launch and every local change is pushed
// back (debounced). localStorage stays as an offline cache/fallback, so the
// installed app keeps working with no connection — changes made offline are
// pushed on the next successful contact.

import { apiBase } from "../net";
import { getName, hydrate, loadCollection, subscribe, switchName } from "./collection";

const NAME_KEY = "cob-name";
const PUSH_DELAY_MS = 800;

export type SyncStatus = "offline" | "local" | "synced" | "syncing" | "error";

let status: SyncStatus = "local";
const statusListeners = new Set<(s: SyncStatus) => void>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function setStatus(s: SyncStatus) {
  if (s === status) return;
  status = s;
  for (const fn of statusListeners) fn(s);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}

export function rememberedName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

function rememberName(name: string | null) {
  try {
    if (name) localStorage.setItem(NAME_KEY, name);
    else localStorage.removeItem(NAME_KEY);
  } catch {
    /* ignore */
  }
}

async function pull(name: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/collection/${encodeURIComponent(name)}`);
    if (res.status === 404) return false; // no server copy yet
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { data: unknown };
    hydrate(body.data as Parameters<typeof hydrate>[0]);
    setStatus("synced");
    return true;
  } catch {
    setStatus("offline");
    return false;
  }
}

async function push(): Promise<void> {
  const name = getName();
  if (!name) return;
  setStatus("syncing");
  try {
    const res = await fetch(`${apiBase()}/collection/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: loadCollection() }),
    });
    setStatus(res.ok ? "synced" : "error");
  } catch {
    setStatus("offline");
  }
}

function schedulePush() {
  if (!getName()) return; // guest play stays local-only
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(push, PUSH_DELAY_MS);
}

// Every collection mutation schedules a push (once a name is claimed).
subscribe(schedulePush);

/** On app launch: if a name is remembered, adopt it and pull from the server. */
export async function initSync(): Promise<void> {
  const name = rememberedName();
  if (!name) {
    setStatus("local");
    return;
  }
  switchName(name);
  const had = await pull(name);
  if (!had) await push(); // server lost/never had it — restore from local
}

/** Claim (or switch to) a name. New names on the server inherit whatever
    progress this device currently has; existing names load from the server. */
export async function claimName(name: string): Promise<void> {
  const carry = loadCollection(); // current (guest or prior) progress
  switchName(name);
  rememberName(name);
  const had = await pull(name);
  if (!had) {
    hydrate(carry); // seed the new named collection with current progress
    await push();
  }
}

/** Drop back to local guest play (keeps the server copy untouched). */
export function signOut(): void {
  rememberName(null);
  switchName(null);
  setStatus("local");
}
