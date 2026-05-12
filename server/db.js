import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { config } from './config.js';
import { decryptText, encryptText } from './crypto.js';

const usePostgres = Boolean(config.databaseUrl);
const sqlite = usePostgres ? null : createSqlite();
const pool = usePostgres ? new Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined }) : null;

function createSqlite() {
  mkdirSync(dirname(config.databasePath), { recursive: true });
  const database = new DatabaseSync(config.databasePath);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return database;
}

function sqliteAll(sql, params = []) {
  return sqlite.prepare(sql).all(...params);
}

function sqliteGet(sql, params = []) {
  return sqlite.prepare(sql).get(...params);
}

function sqliteRun(sql, params = []) {
  return sqlite.prepare(sql).run(...params);
}

async function pgAll(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function pgGet(sql, params = []) {
  const rows = await pgAll(sql, params);
  return rows[0] || null;
}

async function pgRun(sql, params = []) {
  await pool.query(sql, params);
}

function placeholders(count, offset = 1) {
  return Array.from({ length: count }, (_, i) => `$${i + offset}`).join(',');
}

export function now() {
  return new Date().toISOString();
}

export async function migrate() {
  if (usePostgres) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
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
  } else {
    sqlite.exec(`
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
  await encryptLegacyData();
}

function isEncrypted(value) {
  return String(value || '').startsWith('v1:');
}

function isEncryptedOrEmpty(value) {
  return !value || isEncrypted(value);
}

function encryptMaybe(value) {
  if (!value || isEncrypted(value)) return value || '';
  return encryptText(value);
}

async function encryptLegacyData() {
  const people = usePostgres
    ? await pgAll('SELECT id,fname,lname,games,desc_enc,met_enc FROM people')
    : sqliteAll('SELECT id,fname,lname,games,desc_enc,met_enc FROM people');
  for (const row of people) {
    if ([row.fname, row.lname, row.games, row.desc_enc, row.met_enc].every(isEncryptedOrEmpty)) continue;
    const values = [encryptMaybe(row.fname), encryptMaybe(row.lname), encryptMaybe(row.games), encryptMaybe(row.desc_enc), encryptMaybe(row.met_enc), now(), row.id];
    if (usePostgres) await pgRun('UPDATE people SET fname=$1,lname=$2,games=$3,desc_enc=$4,met_enc=$5,updated_at=$6 WHERE id=$7', values);
    else sqliteRun('UPDATE people SET fname=?,lname=?,games=?,desc_enc=?,met_enc=?,updated_at=? WHERE id=?', values);
  }

  const stories = usePostgres
    ? await pgAll('SELECT id,title,story_enc,game,tags_json,people_json,people_raw_json,happened_at FROM stories')
    : sqliteAll('SELECT id,title,story_enc,game,tags_json,people_json,people_raw_json,happened_at FROM stories');
  for (const row of stories) {
    if ([row.title, row.story_enc, row.game, row.tags_json, row.people_json, row.people_raw_json, row.happened_at].every(isEncryptedOrEmpty)) continue;
    const values = [encryptMaybe(row.title), encryptMaybe(row.story_enc), encryptMaybe(row.game), encryptMaybe(row.tags_json), encryptMaybe(row.people_json), encryptMaybe(row.people_raw_json), encryptMaybe(row.happened_at), now(), row.id];
    if (usePostgres) await pgRun('UPDATE stories SET title=$1,story_enc=$2,game=$3,tags_json=$4,people_json=$5,people_raw_json=$6,happened_at=$7,updated_at=$8 WHERE id=$9', values);
    else sqliteRun('UPDATE stories SET title=?,story_enc=?,game=?,tags_json=?,people_json=?,people_raw_json=?,happened_at=?,updated_at=? WHERE id=?', values);
  }
}

export function rowToPerson(row) {
  return row && {
    id: row.id,
    fname: decryptText(row.fname),
    lname: decryptText(row.lname) || '',
    games: decryptText(row.games) || '',
    desc: decryptText(row.desc_enc),
    met: decryptText(row.met_enc)
  };
}

export function rowToStory(row) {
  return row && {
    id: row.id,
    title: decryptText(row.title),
    story: decryptText(row.story_enc),
    game: decryptText(row.game) || '',
    tags: JSON.parse(decryptText(row.tags_json) || '[]'),
    people: JSON.parse(decryptText(row.people_json) || '[]'),
    peopleRaw: JSON.parse(decryptText(row.people_raw_json) || '[]'),
    randomPlayerCount: row.random_player_count || 0,
    accent: row.accent || '',
    starred: Boolean(row.starred),
    date: decryptText(row.happened_at)
  };
}

export function encryptedPerson(data) {
  return {
    fname: encryptText(data.fname),
    lname: encryptText(data.lname || ''),
    games: encryptText(data.games || ''),
    desc_enc: encryptText(data.desc || ''),
    met_enc: encryptText(data.met || '')
  };
}

export function encryptedStory(data) {
  return {
    title: encryptText(data.title),
    story_enc: encryptText(data.story || ''),
    game: encryptText(data.game || ''),
    tags_json: encryptText(JSON.stringify(data.tags || [])),
    people_json: encryptText(JSON.stringify(data.people || [])),
    people_raw_json: encryptText(JSON.stringify(data.peopleRaw || [])),
    random_player_count: Number(data.randomPlayerCount || 0),
    accent: data.accent || '',
    starred: data.starred ? 1 : 0,
    happened_at: encryptText(data.date || new Date().toISOString().slice(0, 10))
  };
}

async function get(sqliteSql, sqliteParams, pgSql = sqliteSql, pgParams = sqliteParams) {
  return usePostgres ? pgGet(pgSql, pgParams) : sqliteGet(sqliteSql, sqliteParams);
}

async function all(sqliteSql, sqliteParams, pgSql = sqliteSql, pgParams = sqliteParams) {
  return usePostgres ? pgAll(pgSql, pgParams) : sqliteAll(sqliteSql, sqliteParams);
}

async function run(sqliteSql, sqliteParams, pgSql = sqliteSql, pgParams = sqliteParams) {
  return usePostgres ? pgRun(pgSql, pgParams) : sqliteRun(sqliteSql, sqliteParams);
}

export async function findUserById(id) {
  return get('SELECT * FROM users WHERE id = ?', [id], 'SELECT * FROM users WHERE id = $1', [id]);
}

export async function findUserByEmail(email) {
  return get('SELECT * FROM users WHERE email = ? COLLATE NOCASE', [email], 'SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
}

export async function findUserByGoogleOrEmail(googleSub, email) {
  return get('SELECT * FROM users WHERE google_sub = ? OR email = ? COLLATE NOCASE', [googleSub, email], 'SELECT * FROM users WHERE google_sub = $1 OR email = $2', [googleSub, email.toLowerCase()]);
}

export async function createPasswordUser(id, email, passwordHash, name) {
  await run(
    'INSERT INTO users (id,email,password_hash,name,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    [id, email.toLowerCase(), passwordHash, name, 0, now(), now()],
    'INSERT INTO users (id,email,password_hash,name,email_verified,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, email.toLowerCase(), passwordHash, name, 0, now(), now()]
  );
}

export async function createGoogleUser(id, email, name, emailVerified, googleSub) {
  await run(
    'INSERT INTO users (id,email,name,email_verified,google_sub,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    [id, email.toLowerCase(), name, emailVerified ? 1 : 0, googleSub, now(), now()],
    'INSERT INTO users (id,email,name,email_verified,google_sub,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, email.toLowerCase(), name, emailVerified ? 1 : 0, googleSub, now(), now()]
  );
}

export async function linkGoogleUser(id, googleSub) {
  await run('UPDATE users SET google_sub = ?, email_verified = 1, updated_at = ? WHERE id = ?', [googleSub, now(), id], 'UPDATE users SET google_sub=$1,email_verified=1,updated_at=$2 WHERE id=$3', [googleSub, now(), id]);
}

export async function createSessionRow(id, userId, tokenHashValue, expiresAt, userAgent, ip) {
  await run(
    'INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,user_agent,ip) VALUES (?,?,?,?,?,?,?)',
    [id, userId, tokenHashValue, expiresAt, now(), userAgent, ip],
    'INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,user_agent,ip) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, userId, tokenHashValue, expiresAt, now(), userAgent, ip]
  );
}

export async function findSessionByTokenHash(tokenHashValue) {
  return get('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?', [tokenHashValue, now()], 'SELECT * FROM sessions WHERE token_hash=$1 AND expires_at>$2', [tokenHashValue, now()]);
}

export async function deleteSessionByTokenHash(tokenHashValue) {
  await run('DELETE FROM sessions WHERE token_hash = ?', [tokenHashValue], 'DELETE FROM sessions WHERE token_hash=$1', [tokenHashValue]);
}

export async function deleteSessionsByUser(userId) {
  await run('DELETE FROM sessions WHERE user_id = ?', [userId], 'DELETE FROM sessions WHERE user_id=$1', [userId]);
}

export async function createResetToken(id, userId, tokenHashValue, expiresAt) {
  await run(
    'INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)',
    [id, userId, tokenHashValue, expiresAt, now()],
    'INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at,created_at) VALUES ($1,$2,$3,$4,$5)',
    [id, userId, tokenHashValue, expiresAt, now()]
  );
}

export async function findValidResetToken(tokenHashValue) {
  return get('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?', [tokenHashValue, now()], 'SELECT * FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>$2', [tokenHashValue, now()]);
}

export async function updatePassword(userId, passwordHash) {
  await run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, now(), userId], 'UPDATE users SET password_hash=$1,updated_at=$2 WHERE id=$3', [passwordHash, now(), userId]);
}

export async function markResetTokenUsed(id) {
  await run('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?', [now(), id], 'UPDATE password_reset_tokens SET used_at=$1 WHERE id=$2', [now(), id]);
}

export async function listPeople(userId, order = 'DESC') {
  const direction = order === 'ASC' ? 'ASC' : 'DESC';
  return (await all(`SELECT * FROM people WHERE user_id = ? ORDER BY created_at ${direction}`, [userId], `SELECT * FROM people WHERE user_id=$1 ORDER BY created_at ${direction}`, [userId])).map(rowToPerson);
}

export async function getPerson(userId, id) {
  return rowToPerson(await get('SELECT * FROM people WHERE id = ? AND user_id = ?', [id, userId], 'SELECT * FROM people WHERE id=$1 AND user_id=$2', [id, userId]));
}

export async function savePerson(userId, id, data) {
  const person = encryptedPerson(data);
  await run(
    'INSERT INTO people (id,user_id,fname,lname,games,desc_enc,met_enc,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, userId, person.fname, person.lname, person.games, person.desc_enc, person.met_enc, now(), now()],
    `INSERT INTO people (id,user_id,fname,lname,games,desc_enc,met_enc,created_at,updated_at) VALUES (${placeholders(9)})`,
    [id, userId, person.fname, person.lname, person.games, person.desc_enc, person.met_enc, now(), now()]
  );
  return getPerson(userId, id);
}

export async function updatePerson(userId, id, data) {
  const person = encryptedPerson(data);
  await run('UPDATE people SET fname=?,lname=?,games=?,desc_enc=?,met_enc=?,updated_at=? WHERE id=? AND user_id=?', [person.fname, person.lname, person.games, person.desc_enc, person.met_enc, now(), id, userId], 'UPDATE people SET fname=$1,lname=$2,games=$3,desc_enc=$4,met_enc=$5,updated_at=$6 WHERE id=$7 AND user_id=$8', [person.fname, person.lname, person.games, person.desc_enc, person.met_enc, now(), id, userId]);
  return getPerson(userId, id);
}

export async function deletePerson(userId, id) {
  await run('DELETE FROM people WHERE id = ? AND user_id = ?', [id, userId], 'DELETE FROM people WHERE id=$1 AND user_id=$2', [id, userId]);
}

export async function listStories(userId, order = 'DESC') {
  const direction = order === 'ASC' ? 'ASC' : 'DESC';
  return (await all(`SELECT * FROM stories WHERE user_id = ? ORDER BY created_at ${direction}`, [userId], `SELECT * FROM stories WHERE user_id=$1 ORDER BY created_at ${direction}`, [userId])).map(rowToStory);
}

export async function getStory(userId, id) {
  return rowToStory(await get('SELECT * FROM stories WHERE id = ? AND user_id = ?', [id, userId], 'SELECT * FROM stories WHERE id=$1 AND user_id=$2', [id, userId]));
}

export async function saveStory(userId, id, data) {
  const story = encryptedStory(data);
  const values = [id, userId, story.title, story.story_enc, story.game, story.tags_json, story.people_json, story.people_raw_json, story.random_player_count, story.accent, story.starred, story.happened_at, now(), now()];
  await run(
    'INSERT INTO stories (id,user_id,title,story_enc,game,tags_json,people_json,people_raw_json,random_player_count,accent,starred,happened_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    values,
    `INSERT INTO stories (id,user_id,title,story_enc,game,tags_json,people_json,people_raw_json,random_player_count,accent,starred,happened_at,created_at,updated_at) VALUES (${placeholders(14)})`,
    values
  );
  return getStory(userId, id);
}

export async function updateStory(userId, id, data) {
  const story = encryptedStory(data);
  const values = [story.title, story.story_enc, story.game, story.tags_json, story.people_json, story.people_raw_json, story.random_player_count, story.accent, story.starred, story.happened_at, now(), id, userId];
  await run('UPDATE stories SET title=?,story_enc=?,game=?,tags_json=?,people_json=?,people_raw_json=?,random_player_count=?,accent=?,starred=?,happened_at=?,updated_at=? WHERE id=? AND user_id=?', values, 'UPDATE stories SET title=$1,story_enc=$2,game=$3,tags_json=$4,people_json=$5,people_raw_json=$6,random_player_count=$7,accent=$8,starred=$9,happened_at=$10,updated_at=$11 WHERE id=$12 AND user_id=$13', values);
  return getStory(userId, id);
}

export async function deleteStory(userId, id) {
  await run('DELETE FROM stories WHERE id = ? AND user_id = ?', [id, userId], 'DELETE FROM stories WHERE id=$1 AND user_id=$2', [id, userId]);
}

export async function replaceArchive(userId, people, stories, idFactory) {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM stories WHERE user_id=$1', [userId]);
      await client.query('DELETE FROM people WHERE user_id=$1', [userId]);
      await insertArchiveRows({ query: client.query.bind(client) }, userId, people, stories, idFactory, true);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    sqlite.exec('BEGIN');
    try {
      sqliteRun('DELETE FROM stories WHERE user_id = ?', [userId]);
      sqliteRun('DELETE FROM people WHERE user_id = ?', [userId]);
      await insertArchiveRows(null, userId, people, stories, idFactory, true);
      sqlite.exec('COMMIT');
    } catch (err) {
      sqlite.exec('ROLLBACK');
      throw err;
    }
  }
}

export async function appendArchive(userId, people, stories, idFactory) {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await insertArchiveRows({ query: client.query.bind(client) }, userId, people, stories, idFactory, true);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    sqlite.exec('BEGIN');
    try {
      await insertArchiveRows(null, userId, people, stories, idFactory, true);
      sqlite.exec('COMMIT');
    } catch (err) {
      sqlite.exec('ROLLBACK');
      throw err;
    }
  }
}

async function insertArchiveRows(client, userId, people, stories, idFactory) {
  const personIdMap = new Map();
  for (const person of people) {
    if (!person?.fname) continue;
    const id = idFactory();
    personIdMap.set(person.id, id);
    const data = encryptedPerson(person);
    const values = [id, userId, data.fname, data.lname, data.games, data.desc_enc, data.met_enc, now(), now()];
    if (usePostgres) await client.query(`INSERT INTO people (id,user_id,fname,lname,games,desc_enc,met_enc,created_at,updated_at) VALUES (${placeholders(9)})`, values);
    else sqliteRun('INSERT INTO people (id,user_id,fname,lname,games,desc_enc,met_enc,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)', values);
  }
  for (const story of stories) {
    if (!story?.title || !story?.story) continue;
    const mappedPeople = (story.people || []).map(id => personIdMap.get(id) || id).filter(Boolean);
    const data = encryptedStory({ ...story, people: mappedPeople });
    const values = [idFactory(), userId, data.title, data.story_enc, data.game, data.tags_json, data.people_json, data.people_raw_json, data.random_player_count, data.accent, data.starred, data.happened_at, now(), now()];
    if (usePostgres) await client.query(`INSERT INTO stories (id,user_id,title,story_enc,game,tags_json,people_json,people_raw_json,random_player_count,accent,starred,happened_at,created_at,updated_at) VALUES (${placeholders(14)})`, values);
    else sqliteRun('INSERT INTO stories (id,user_id,title,story_enc,game,tags_json,people_json,people_raw_json,random_player_count,accent,starred,happened_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', values);
  }
}
