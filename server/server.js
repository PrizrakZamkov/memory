import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import {
  appendArchive,
  createGoogleUser,
  createPasswordUser,
  createResetToken,
  createSessionRow,
  deletePerson,
  deleteSessionByTokenHash,
  deleteSessionsByUser,
  deleteStory,
  findSessionByTokenHash,
  findUserByEmail,
  findUserByGoogleOrEmail,
  findUserById,
  findValidResetToken,
  linkGoogleUser,
  listPeople,
  listStories,
  markResetTokenUsed,
  migrate,
  now,
  replaceArchive,
  savePerson,
  saveStory,
  updatePassword,
  updatePerson,
  updateStory
} from './db.js';
import { config, isProd } from './config.js';
import { hashPassword, newToken, tokenHash, verifyPassword } from './crypto.js';

await migrate();

const rateBuckets = new Map();
const distDir = resolve('dist');

function json(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...securityHeaders(), ...extraHeaders });
  res.end(JSON.stringify(data));
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))];
  }));
}

function setSessionCookie(res, token, expires) {
  const attrs = [
    `sid=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Expires=${expires.toUTCString()}`
  ];
  if (isProd) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `sid=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT${isProd ? '; Secure' : ''}`);
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function rateLimit(req, res, key, max, windowMs) {
  const bucketKey = `${clientIp(req)}:${key}`;
  const t = Date.now();
  const bucket = rateBuckets.get(bucketKey) || { count: 0, reset: t + windowMs };
  if (t > bucket.reset) {
    bucket.count = 0;
    bucket.reset = t + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(bucketKey, bucket);
  if (bucket.count > max) {
    json(res, 429, { error: 'Too many requests. Try again later.' }, { 'Retry-After': String(Math.ceil((bucket.reset - t) / 1000)) });
    return false;
  }
  return true;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function assertOrigin(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.origin;
  const allowed = new Set([config.appOrigin, config.publicAppUrl]);
  if (!isProd) {
    allowed.add('http://127.0.0.1:3000');
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:5173');
    allowed.add('http://localhost:5173');
  }
  if (origin && !allowed.has(origin)) {
    throw Object.assign(new Error('Bad origin'), { status: 403 });
  }
}

function requireFields(body, fields) {
  for (const field of fields) {
    if (!String(body[field] || '').trim()) throw Object.assign(new Error(`${field} is required`), { status: 400 });
  }
}

function publicUser(user) {
  return user && { id: user.id, email: user.email, name: user.name || '', emailVerified: Boolean(user.email_verified) };
}

async function currentUser(req) {
  const token = parseCookies(req).sid;
  if (!token) return null;
  const session = await findSessionByTokenHash(tokenHash(token));
  if (!session) return null;
  return findUserById(session.user_id);
}

async function createSession(res, req, userId) {
  const token = newToken(48);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await createSessionRow(randomUUID(), userId, tokenHash(token), expires.toISOString(), req.headers['user-agent'] || '', clientIp(req));
  setSessionCookie(res, token, expires);
}

async function authRoutes(req, res, url) {
  if (url.pathname === '/api/auth/register' && req.method === 'POST') {
    if (!rateLimit(req, res, 'register', 8, 60_000)) return true;
    const body = await readBody(req);
    requireFields(body, ['email', 'password']);
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Invalid email' }), true;
    if (String(body.password).length < 10) return json(res, 400, { error: 'Password must be at least 10 characters' }), true;
    const password = await hashPassword(String(body.password));
    const id = randomUUID();
    try {
      await createPasswordUser(id, email, password, String(body.name || '').trim());
    } catch {
      return json(res, 409, { error: 'Email is already registered' }), true;
    }
    await createSession(res, req, id);
    return json(res, 201, { user: publicUser(await findUserById(id)) }), true;
  }

  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    if (!rateLimit(req, res, 'login', 10, 60_000)) return true;
    const body = await readBody(req);
    requireFields(body, ['email', 'password']);
    const user = await findUserByEmail(String(body.email).trim().toLowerCase());
    if (!user || !user.password_hash || !(await verifyPassword(String(body.password), user.password_hash))) {
      return json(res, 401, { error: 'Invalid email or password' }), true;
    }
    await createSession(res, req, user.id);
    return json(res, 200, { user: publicUser(user) }), true;
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = parseCookies(req).sid;
    if (token) await deleteSessionByTokenHash(tokenHash(token));
    clearSessionCookie(res);
    return json(res, 200, { ok: true }), true;
  }

  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    return json(res, 200, { user: publicUser(await currentUser(req)) }), true;
  }

  if (url.pathname === '/api/auth/forgot-password' && req.method === 'POST') {
    if (!rateLimit(req, res, 'forgot', 5, 60_000)) return true;
    const body = await readBody(req);
    const user = await findUserByEmail(String(body.email || '').trim().toLowerCase());
    let resetLink = null;
    if (user) {
      const token = newToken(32);
      const expires = new Date(Date.now() + 1000 * 60 * 30);
      await createResetToken(randomUUID(), user.id, tokenHash(token), expires.toISOString());
      resetLink = `${config.publicAppUrl}/reset-password?token=${token}`;
      if (isProd) console.log(`Password reset requested for ${user.email}. Configure a mail provider to send: ${resetLink}`);
    }
    return json(res, 200, { ok: true, devResetLink: isProd ? undefined : resetLink }), true;
  }

  if (url.pathname === '/api/auth/reset-password' && req.method === 'POST') {
    if (!rateLimit(req, res, 'reset', 8, 60_000)) return true;
    const body = await readBody(req);
    requireFields(body, ['token', 'password']);
    if (String(body.password).length < 10) return json(res, 400, { error: 'Password must be at least 10 characters' }), true;
    const row = await findValidResetToken(tokenHash(String(body.token)));
    if (!row) return json(res, 400, { error: 'Invalid or expired reset link' }), true;
    await updatePassword(row.user_id, await hashPassword(String(body.password)));
    await markResetTokenUsed(row.id);
    await deleteSessionsByUser(row.user_id);
    return json(res, 200, { ok: true }), true;
  }

  if (url.pathname === '/api/auth/google' && req.method === 'GET') {
    if (!config.googleClientId) return json(res, 501, { error: 'Google OAuth is not configured' }), true;
    const state = newToken(16);
    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: config.googleRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account'
    });
    res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, ...securityHeaders() });
    res.end();
    return true;
  }

  if (url.pathname === '/api/auth/google/callback' && req.method === 'GET') {
    if (!config.googleClientId || !config.googleClientSecret) return json(res, 501, { error: 'Google OAuth is not configured' }), true;
    const code = url.searchParams.get('code');
    if (!code) return json(res, 400, { error: 'Missing code' }), true;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: config.googleClientId, client_secret: config.googleClientSecret, redirect_uri: config.googleRedirectUri, grant_type: 'authorization_code' })
    });
    const tokenData = await tokenRes.json();
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const profile = await profileRes.json();
    if (!profile.email || !profile.sub) return json(res, 401, { error: 'Google login failed' }), true;
    let user = await findUserByGoogleOrEmail(profile.sub, profile.email);
    if (!user) {
      const id = randomUUID();
      await createGoogleUser(id, profile.email.toLowerCase(), profile.name || '', profile.email_verified, profile.sub);
      user = await findUserById(id);
    } else if (!user.google_sub) {
      await linkGoogleUser(user.id, profile.sub);
    }
    await createSession(res, req, user.id);
    res.writeHead(302, { Location: config.publicAppUrl, ...securityHeaders() });
    res.end();
    return true;
  }

  return false;
}

async function apiRoutes(req, res, url) {
  const user = await currentUser(req);
  if (!user) return json(res, 401, { error: 'Authentication required' }), true;

  if (url.pathname === '/api/export' && req.method === 'GET') {
    const people = await listPeople(user.id, 'ASC');
    const stories = await listStories(user.id, 'ASC');
    return json(res, 200, { version: 1, exportedAt: now(), people, stories }), true;
  }

  if (url.pathname === '/api/import' && req.method === 'POST') {
    if (!rateLimit(req, res, 'import', 6, 60_000)) return true;
    const body = await readBody(req);
    const people = Array.isArray(body.people) ? body.people : [];
    const stories = Array.isArray(body.stories) ? body.stories : [];
    const replace = body.mode !== 'append';
    if (replace) await replaceArchive(user.id, people, stories, randomUUID);
    else await appendArchive(user.id, people, stories, randomUUID);
    return json(res, 200, { ok: true, imported: { people: people.length, stories: stories.length } }), true;
  }

  if (url.pathname === '/api/people' && req.method === 'GET') {
    return json(res, 200, { people: await listPeople(user.id) }), true;
  }

  if (url.pathname === '/api/people' && req.method === 'POST') {
    const body = await readBody(req);
    requireFields(body, ['fname']);
    const id = randomUUID();
    return json(res, 201, { person: await savePerson(user.id, id, body) }), true;
  }

  const peopleMatch = url.pathname.match(/^\/api\/people\/([^/]+)$/);
  if (peopleMatch && req.method === 'PATCH') {
    const body = await readBody(req);
    requireFields(body, ['fname']);
    return json(res, 200, { person: await updatePerson(user.id, peopleMatch[1], body) }), true;
  }

  if (peopleMatch && req.method === 'DELETE') {
    await deletePerson(user.id, peopleMatch[1]);
    return json(res, 200, { ok: true }), true;
  }

  if (url.pathname === '/api/stories' && req.method === 'GET') {
    return json(res, 200, { stories: await listStories(user.id) }), true;
  }

  if (url.pathname === '/api/stories' && req.method === 'POST') {
    const body = await readBody(req);
    requireFields(body, ['title', 'story']);
    const id = randomUUID();
    return json(res, 201, { story: await saveStory(user.id, id, body) }), true;
  }

  const storyMatch = url.pathname.match(/^\/api\/stories\/([^/]+)$/);
  if (storyMatch && req.method === 'PATCH') {
    const body = await readBody(req);
    requireFields(body, ['title', 'story']);
    return json(res, 200, { story: await updateStory(user.id, storyMatch[1], body) }), true;
  }

  if (storyMatch && req.method === 'DELETE') {
    await deleteStory(user.id, storyMatch[1]);
    return json(res, 200, { ok: true }), true;
  }

  return false;
}

async function serveStatic(req, res, url) {
  if (!isProd) return json(res, 404, { error: 'Not found' });
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = join(distDir, pathname);
  try {
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', ...securityHeaders() });
    res.end(data);
  } catch {
    const data = await readFile(join(distDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html', ...securityHeaders() });
    res.end(data);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    assertOrigin(req);
    if (req.method === 'OPTIONS') return json(res, 204, {});
    if (await authRoutes(req, res, url)) return;
    if (url.pathname.startsWith('/api/') && await apiRoutes(req, res, url)) return;
    await serveStatic(req, res, url);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    json(res, status, { error: status >= 500 ? 'Server error' : err.message });
  }
});

server.headersTimeout = 10_000;
server.requestTimeout = 15_000;
server.listen(config.port, config.host, () => {
  console.log(`Storyline API listening on http://${config.host}:${config.port}`);
});
