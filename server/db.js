import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { decryptText, encryptText } from './crypto.js';

mkdirSync(dirname(config.databasePath), { recursive: true });
export const db = new DatabaseSync(config.databasePath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT,
      name TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      google_sub TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      user_agent TEXT,
      ip TEXT
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fname TEXT NOT NULL,
      lname TEXT,
      games TEXT,
      desc_enc TEXT,
      met_enc TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      story_enc TEXT NOT NULL,
      game TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      people_json TEXT NOT NULL DEFAULT '[]',
      people_raw_json TEXT NOT NULL DEFAULT '[]',
      random_player_count INTEGER NOT NULL DEFAULT 0,
      accent TEXT,
      starred INTEGER NOT NULL DEFAULT 0,
      happened_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_people_user ON people(user_id);
    CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(token_hash);
  `);
}

export function now() {
  return new Date().toISOString();
}

export function rowToPerson(row) {
  return row && {
    id: row.id,
    fname: row.fname,
    lname: row.lname || '',
    games: row.games || '',
    desc: decryptText(row.desc_enc),
    met: decryptText(row.met_enc)
  };
}

export function rowToStory(row) {
  return row && {
    id: row.id,
    title: row.title,
    story: decryptText(row.story_enc),
    game: row.game || '',
    tags: JSON.parse(row.tags_json || '[]'),
    people: JSON.parse(row.people_json || '[]'),
    peopleRaw: JSON.parse(row.people_raw_json || '[]'),
    randomPlayerCount: row.random_player_count || 0,
    accent: row.accent || '',
    starred: Boolean(row.starred),
    date: row.happened_at
  };
}

export function encryptedPerson(data) {
  return {
    fname: data.fname,
    lname: data.lname || '',
    games: data.games || '',
    desc_enc: encryptText(data.desc || ''),
    met_enc: encryptText(data.met || '')
  };
}

export function encryptedStory(data) {
  return {
    title: data.title,
    story_enc: encryptText(data.story || ''),
    game: data.game || '',
    tags_json: JSON.stringify(data.tags || []),
    people_json: JSON.stringify(data.people || []),
    people_raw_json: JSON.stringify(data.peopleRaw || []),
    random_player_count: Number(data.randomPlayerCount || 0),
    accent: data.accent || '',
    starred: data.starred ? 1 : 0,
    happened_at: data.date || new Date().toISOString().slice(0, 10)
  };
}
