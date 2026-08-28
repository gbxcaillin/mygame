// Collection storage for Court of Beasts.
//
// Server-primary player collections keyed by a claimed name (no auth — a
// friends-and-family trust model). SQLite via better-sqlite3, same stack
// as familyoffice. The DB file lives in a mounted volume so it survives
// container rebuilds.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH || "/data/collections.db";

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS collections (
    name       TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const getStmt = db.prepare("SELECT data, updated_at FROM collections WHERE name = ?");
const putStmt = db.prepare(`
  INSERT INTO collections (name, data, updated_at) VALUES (@name, @data, @updated_at)
  ON CONFLICT(name) DO UPDATE SET data = @data, updated_at = @updated_at
`);
const existsStmt = db.prepare("SELECT 1 FROM collections WHERE name = ?");

/** Normalize a claimed name to its storage key (case/space-insensitive). */
export function normalizeName(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

export function isValidName(raw) {
  const n = normalizeName(raw);
  return n.length >= 2 && /^[a-z0-9 ._-]+$/.test(n);
}

export function getCollection(name) {
  const key = normalizeName(name);
  const row = getStmt.get(key);
  if (!row) return null;
  try {
    return { data: JSON.parse(row.data), updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

export function putCollection(name, data) {
  const key = normalizeName(name);
  const updated_at = Date.now();
  putStmt.run({ name: key, data: JSON.stringify(data), updated_at });
  return updated_at;
}

export function nameExists(name) {
  return !!existsStmt.get(normalizeName(name));
}
