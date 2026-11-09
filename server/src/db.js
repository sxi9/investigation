// SQLite storage (node:sqlite, no native build step). One file per deployment under data/.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, name_lc TEXT NOT NULL UNIQUE, role TEXT NOT NULL,
      salt TEXT NOT NULL, hash TEXT NOT NULL, tlp_red INTEGER NOT NULL DEFAULT 0, cases TEXT NOT NULL DEFAULT '"all"',
      must_change INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_login TEXT,
      failed INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      seen_at INTEGER NOT NULL, ip TEXT, ua TEXT
    );
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY, number TEXT, title TEXT, tlp TEXT NOT NULL DEFAULT '', public INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0, review TEXT NOT NULL DEFAULT 'draft', owner_id TEXT, rev INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL, updated_by TEXT, deleted_at TEXT, doc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prefs (user_id TEXT NOT NULL, kind TEXT NOT NULL, doc TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, kind));
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, mime TEXT, name TEXT,
      created_at TEXT NOT NULL, path TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, t TEXT NOT NULL, who TEXT NOT NULL, what TEXT NOT NULL, ip TEXT,
      prev_hash TEXT NOT NULL, hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_cases_deleted ON cases(deleted_at);
  `);
  return db;
}

export const db = openDb(process.env.CIB_DB_FILE || path.join(config.dataDir, 'cib.sqlite'));
