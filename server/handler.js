// The sync server. It never sees readable data: records, images and keys arrive encrypted.
// It knows only the Google account id and email, the device list, sizes and change times.
// createHandler(deps) returns (request, { ip }) => Response, so it runs on Netlify and in tests.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const DAY = 24 * 60 * 60 * 1000;
const SESSION_MS = 30 * DAY;
const OAUTH_MS = 10 * 60 * 1000;
const PAIRING_MS = 10 * 60 * 1000;
const MAX_BODY = 5_500_000;
const MAX_RECORD_DATA = 400_000;
const MAX_IMAGE_DATA = 4_500_000;
const MAX_RECORDS = 20000;
const MAX_IMAGES = 5000;
const MAX_PENDING_PAIRINGS = 5;

const SESSION_COOKIE = '__Host-gf_session';
const OAUTH_COOKIE = '__Host-gf_oauth';
const GOOGLE = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  issuers: ['https://accounts.google.com', 'accounts.google.com']
};

const ID = /^[A-Za-z0-9._-]{1,80}$/;
const B64 = /^[A-Za-z0-9+/]*={0,2}$/;
const IMAGE_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

const fail = (status, code) => { throw new HttpError(status, code); };

const randomId = (bytes = 18) => randomBytes(bytes).toString('base64url');
const sha256 = text => createHash('sha256').update(text).digest('hex');

function sameText(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};

function json(status, body, cookies = []) {
  const headers = new Headers(BASE_HEADERS);
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function cookie(name, value, { maxAge, sameSite = 'Strict' }) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

const clearCookie = (name, sameSite = 'Strict') => cookie(name, '', { maxAge: 0, sameSite });

function readCookies(request) {
  const out = {};
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) out[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return out;
}

function deviceName(userAgent = '') {
  const os = [['Android', 'Android'], ['iPhone', 'iPhone'], ['iPad', 'iPad'], ['Windows', 'Windows'], ['Mac OS', 'Mac'], ['Linux', 'Linux']]
    .find(([needle]) => userAgent.includes(needle))?.[1] || '';
  const browser = [['YaBrowser', 'Yandex Browser'], ['Edg/', 'Edge'], ['Firefox', 'Firefox'], ['Chrome', 'Chrome'], ['Safari', 'Safari']]
    .find(([needle]) => userAgent.includes(needle))?.[1] || 'Browser';
  return os ? `${browser}, ${os}` : browser;
}

function isB64(value, maxLength, exactLength) {
  if (typeof value !== 'string' || value.length > maxLength || !B64.test(value)) return false;
  return exactLength === undefined || value.length === exactLength;
}

function checkBox(box, maxData) {
  if (!box || !isB64(box.iv, 16, 16) || !isB64(box.data, maxData) || !box.data) fail(400, 'bad-box');
  return { iv: box.iv, data: box.data };
}

function decodeJwtPayload(token) {
  const part = String(token || '').split('.')[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function createHandler({ store, env, fetchImpl = fetch, now = Date.now, google = {} }) {
  const oauth = { ...GOOGLE, ...google };

  async function readBody(request) {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > MAX_BODY) fail(413, 'too-large');
    const text = await request.text();
    if (text.length > MAX_BODY) fail(413, 'too-large');
    try {
      return JSON.parse(text || '{}');
    } catch {
      fail(400, 'bad-json');
    }
  }

  function siteOrigin(request) {
    return env.SITE_URL ? new URL(env.SITE_URL).origin : new URL(request.url).origin;
  }

  // Blocks requests from other sites. Cookies are SameSite=Strict as a second line.
  function checkWriteRequest(request) {
    if (request.headers.get('origin') !== siteOrigin(request)) fail(403, 'bad-origin');
    if (request.headers.get('x-requested-with') !== 'gamefolk') fail(403, 'bad-request');
  }

  async function currentSession(request) {
    const token = readCookies(request)[SESSION_COOKIE];
    if (!token || token.length > 64) return null;
    const hash = sha256(token);
    const session = await store.getJSON(`sess/${hash}`);
    if (!session || session.exp < now()) return null;
    const key = `dev/${session.uid}/${session.deviceId}`;
    const device = await store.getJSON(key);
    if (!device) return null;
    if (now() - device.lastSeenAt > 60 * 60 * 1000) await store.setJSON(key, { ...device, lastSeenAt: now() });
    return { ...session, hash };
  }

  async function changeCount(uid, field, delta) {
    const user = await store.getJSON(`user/${uid}`);
    if (!user) return;
    await store.setJSON(`user/${uid}`, { ...user, [field]: Math.max(0, (user[field] || 0) + delta) });
  }

  // Login with Google: authorization code flow with state, nonce and PKCE.
  async function googleStart(request) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) fail(501, 'login-not-configured');
    const state = randomId(24);
    const nonce = randomId(24);
    const verifier = randomId(48);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${siteOrigin(request)}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account'
    });
    const saved = Buffer.from(JSON.stringify({ state, nonce, verifier, exp: now() + OAUTH_MS })).toString('base64url');
    return redirect(`${oauth.authUrl}?${params}`, [cookie(OAUTH_COOKIE, saved, { maxAge: OAUTH_MS / 1000, sameSite: 'Lax' })]);
  }

  async function googleCallback(request) {
    const url = new URL(request.url);
    const failed = () => redirect('/?login=failed', [clearCookie(OAUTH_COOKIE, 'Lax')]);
    let saved;
    try {
      saved = JSON.parse(Buffer.from(readCookies(request)[OAUTH_COOKIE] || '', 'base64url').toString('utf8'));
    } catch {
      return failed();
    }
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!saved?.state || !code || !state || !sameText(state, saved.state) || saved.exp < now()) return failed();

    const tokenResponse = await fetchImpl(oauth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${siteOrigin(request)}/api/auth/google/callback`,
        grant_type: 'authorization_code',
        code_verifier: saved.verifier
      })
    });
    if (!tokenResponse.ok) return failed();
    // The token comes straight from Google over HTTPS with our client secret,
    // so its claims can be trusted without checking the signature (OpenID Connect 3.1.3.7).
    const claims = decodeJwtPayload((await tokenResponse.json()).id_token);
    const valid = claims
      && oauth.issuers.includes(claims.iss)
      && claims.aud === env.GOOGLE_CLIENT_ID
      && Number(claims.exp) * 1000 > now()
      && claims.nonce === saved.nonce
      && (claims.email_verified === true || claims.email_verified === 'true')
      && typeof claims.sub === 'string' && claims.sub.length < 256;
    if (!valid) return failed();

    const uid = await findOrCreateUser(claims.sub, String(claims.email || '').slice(0, 320));
    const token = randomId(32);
    const hash = sha256(token);
    const deviceId = randomId(12);
    await store.setJSON(`sess/${hash}`, { uid, deviceId, exp: now() + SESSION_MS });
    await store.setJSON(`dev/${uid}/${deviceId}`, {
      name: deviceName(request.headers.get('user-agent') || ''),
      createdAt: now(),
      lastSeenAt: now(),
      session: hash
    });
    return redirect('/?login=ok', [
      cookie(SESSION_COOKIE, token, { maxAge: SESSION_MS / 1000 }),
      clearCookie(OAUTH_COOKIE, 'Lax')
    ]);
  }

  async function findOrCreateUser(sub, email) {
    const key = `google/${sha256(sub)}`;
    const existing = await store.getJSON(key);
    if (existing) {
      const user = await store.getJSON(`user/${existing.uid}`);
      if (user && user.email !== email) await store.setJSON(`user/${existing.uid}`, { ...user, email });
      return existing.uid;
    }
    const uid = randomId();
    const created = await store.setJSON(key, { uid }, { onlyIfNew: true });
    if (!created.modified) return (await store.getJSON(key)).uid;
    await store.setJSON(`user/${uid}`, { email, googleKey: key, createdAt: now(), records: 0, images: 0 });
    return uid;
  }

  async function deleteDevice(uid, deviceId) {
    const device = await store.getJSON(`dev/${uid}/${deviceId}`);
    if (device?.session) await store.delete(`sess/${device.session}`);
    await store.delete(`dev/${uid}/${deviceId}`);
  }

  async function deleteAccount(uid) {
    for (const prefix of ['rec/', 'img/', 'pair/', 'dev/']) {
      for (const { key } of await store.list(`${prefix}${uid}/`)) {
        if (prefix === 'dev/') {
          const device = await store.getJSON(key);
          if (device?.session) await store.delete(`sess/${device.session}`);
        }
        await store.delete(key);
      }
    }
    const user = await store.getJSON(`user/${uid}`);
    if (user?.googleKey) await store.delete(user.googleKey);
    await store.delete(`vault/${uid}`);
    await store.delete(`user/${uid}`);
  }

  async function pendingPairings(uid) {
    const list = [];
    for (const { key } of await store.list(`pair/${uid}/`)) {
      const item = await store.getJSON(key);
      if (!item || item.createdAt + PAIRING_MS < now()) {
        await store.delete(key);
        continue;
      }
      list.push({ id: key.split('/').pop(), ...item });
    }
    return list;
  }

  async function routeApi(request, path, session) {
    const { uid, deviceId } = session;
    const method = request.method;
    const parts = path.split('/').filter(Boolean);

    if (method === 'GET' && path === 'me') {
      const user = await store.getJSON(`user/${uid}`);
      const vault = await store.getJSON(`vault/${uid}`);
      return json(200, { email: user?.email || '', deviceId, hasVault: Boolean(vault) });
    }

    if (path === 'vault') {
      if (method === 'GET') {
        const vault = await store.getJSON(`vault/${uid}`);
        return vault ? json(200, vault) : json(404, { error: 'no-vault' });
      }
      if (method === 'PUT') {
        const body = await readBody(request);
        const header = {
          recovery: { salt: body?.recovery?.salt, ...checkBox(body?.recovery, 200) },
          recoveryText: checkBox(body?.recoveryText, 200)
        };
        if (!isB64(header.recovery.salt, 24, 24)) fail(400, 'bad-box');
        const result = await store.setJSON(`vault/${uid}`, header, { onlyIfNew: true });
        return result.modified ? json(201, { ok: true }) : json(409, { error: 'vault-exists' });
      }
    }

    if (method === 'GET' && path === 'records') {
      const records = (await store.list(`rec/${uid}/`)).map(({ key, etag }) => ({ id: key.split('/').pop(), etag }));
      return json(200, { records });
    }

    if (method === 'POST' && path === 'records/fetch') {
      const body = await readBody(request);
      const ids = Array.isArray(body?.ids) ? body.ids.filter(id => ID.test(id)).slice(0, 200) : [];
      const records = [];
      for (const id of ids) {
        const found = await store.getJSONWithEtag(`rec/${uid}/${id}`);
        if (found) records.push({ id, etag: found.etag, env: found.value });
      }
      return json(200, { records });
    }

    if (parts[0] === 'records' && parts.length === 2 && method === 'PUT') {
      const id = parts[1];
      if (!ID.test(id)) fail(400, 'bad-id');
      const body = await readBody(request);
      const t = Number(body?.t);
      if (!['person', 'story'].includes(body?.kind) || !Number.isInteger(t) || t < 0 || t > now() + DAY) fail(400, 'bad-record');
      const env = { kind: body.kind, t, deleted: Boolean(body.deleted) };
      if (!env.deleted) env.box = checkBox(body.box, MAX_RECORD_DATA);

      const key = `rec/${uid}/${id}`;
      const existing = await store.getJSONWithEtag(key);
      // Last write wins: an older change never overwrites a newer one.
      if (existing && existing.value.t >= t) return json(409, { error: 'newer-exists', etag: existing.etag, t: existing.value.t });
      if (!existing) {
        const user = await store.getJSON(`user/${uid}`);
        if ((user?.records || 0) >= MAX_RECORDS) fail(413, 'quota');
      }
      const result = await store.setJSON(key, env, existing ? { onlyIfMatch: existing.etag } : { onlyIfNew: true });
      if (!result.modified) return json(409, { error: 'changed-meanwhile' });
      if (!existing) await changeCount(uid, 'records', 1);
      return json(200, { etag: result.etag });
    }

    if (parts[0] === 'images' && parts.length === 2) {
      const id = parts[1];
      if (!ID.test(id)) fail(400, 'bad-id');
      const key = `img/${uid}/${id}`;
      if (method === 'GET') {
        const image = await store.getJSON(key);
        return image ? json(200, { type: image.type, box: image.box }) : json(404, { error: 'not-found' });
      }
      if (method === 'PUT') {
        const body = await readBody(request);
        if (!IMAGE_TYPES.has(body?.type)) fail(400, 'bad-type');
        const box = checkBox(body.box, MAX_IMAGE_DATA);
        const user = await store.getJSON(`user/${uid}`);
        if ((user?.images || 0) >= MAX_IMAGES) fail(413, 'quota');
        const result = await store.setJSON(key, { type: body.type, box, t: now() }, { onlyIfNew: true });
        if (result.modified) await changeCount(uid, 'images', 1);
        return json(200, { ok: true });
      }
      if (method === 'DELETE') {
        if (await store.getJSON(key)) {
          await store.delete(key);
          await changeCount(uid, 'images', -1);
        }
        return json(200, { ok: true });
      }
    }

    if (method === 'GET' && path === 'devices') {
      const devices = [];
      for (const { key } of await store.list(`dev/${uid}/`)) {
        const device = await store.getJSON(key);
        const id = key.split('/').pop();
        if (device) devices.push({ id, name: device.name, createdAt: device.createdAt, lastSeenAt: device.lastSeenAt, current: id === deviceId });
      }
      return json(200, { devices });
    }

    if (parts[0] === 'devices' && parts.length === 2 && method === 'DELETE') {
      if (!ID.test(parts[1])) fail(400, 'bad-id');
      await deleteDevice(uid, parts[1]);
      return json(200, { ok: true }, parts[1] === deviceId ? [clearCookie(SESSION_COOKIE)] : []);
    }

    if (method === 'POST' && path === 'auth/logout-all') {
      for (const { key } of await store.list(`dev/${uid}/`)) await deleteDevice(uid, key.split('/').pop());
      return json(200, { ok: true }, [clearCookie(SESSION_COOKIE)]);
    }

    if (method === 'DELETE' && path === 'account') {
      await deleteAccount(uid);
      return json(200, { ok: true }, [clearCookie(SESSION_COOKIE)]);
    }

    // Moving the data key to a new device. The server only passes along public keys
    // and the data key wrapped for the new device; both screens show a code to compare.
    if (path === 'pairing' && method === 'POST') {
      const body = await readBody(request);
      if (!isB64(body?.publicKey, 88, 88)) fail(400, 'bad-key');
      const pending = (await pendingPairings(uid)).filter(p => p.status === 'pending');
      if (pending.length >= MAX_PENDING_PAIRINGS) fail(429, 'too-many');
      const id = randomId(12);
      const device = await store.getJSON(`dev/${uid}/${deviceId}`);
      await store.setJSON(`pair/${uid}/${id}`, {
        publicKey: body.publicKey, deviceId, deviceName: device?.name || '', createdAt: now(), status: 'pending'
      });
      return json(201, { id });
    }

    if (path === 'pairing' && method === 'GET') {
      const requests = (await pendingPairings(uid))
        .filter(p => p.status === 'pending' && p.deviceId !== deviceId)
        .map(p => ({ id: p.id, publicKey: p.publicKey, deviceName: p.deviceName, createdAt: p.createdAt }));
      return json(200, { requests });
    }

    if (parts[0] === 'pairing' && parts[1] && ID.test(parts[1])) {
      const key = `pair/${uid}/${parts[1]}`;
      const item = await store.getJSON(key);
      if (!item || item.createdAt + PAIRING_MS < now()) return json(404, { error: 'expired' });

      if (parts.length === 2 && method === 'GET') {
        if (item.deviceId !== deviceId) fail(403, 'not-yours');
        if (item.status === 'approved') {
          await store.delete(key);
          return json(200, { status: 'approved', response: item.response });
        }
        return json(200, { status: item.status });
      }

      if (parts.length === 3 && method === 'POST') {
        if (item.deviceId === deviceId) fail(403, 'same-device');
        if (item.status !== 'pending') fail(409, 'already-answered');
        if (parts[2] === 'reject') {
          await store.setJSON(key, { ...item, status: 'rejected' });
          return json(200, { ok: true });
        }
        if (parts[2] === 'approve') {
          const body = await readBody(request);
          if (!isB64(body?.publicKey, 88, 88)) fail(400, 'bad-key');
          const wrapped = checkBox(body.wrapped, 200);
          await store.setJSON(key, { ...item, status: 'approved', response: { publicKey: body.publicKey, wrapped } });
          return json(200, { ok: true });
        }
      }
    }

    return json(404, { error: 'not-found' });
  }

  return async function handle(request) {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/')) return json(404, { error: 'not-found' });
      const path = url.pathname.slice(5).replace(/\/+$/, '');
      const isWrite = !['GET', 'HEAD'].includes(request.method);
      if (isWrite) checkWriteRequest(request);

      if (request.method === 'GET' && path === 'auth/google/start') return await googleStart(request);
      if (request.method === 'GET' && path === 'auth/google/callback') return await googleCallback(request);

      const session = await currentSession(request);
      if (request.method === 'POST' && path === 'auth/logout') {
        if (session) await deleteDevice(session.uid, session.deviceId);
        return json(200, { ok: true }, [clearCookie(SESSION_COOKIE)]);
      }
      if (!session) return json(401, { error: 'login-required' });
      return await routeApi(request, path, session);
    } catch (error) {
      if (error instanceof HttpError) return json(error.status, { error: error.message });
      console.error('api error', error?.name, error?.message);
      return json(500, { error: 'server' });
    }
  };
}
