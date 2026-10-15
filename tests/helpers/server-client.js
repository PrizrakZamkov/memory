// Test helpers: a handler with a fake Google, and a browser-like client with cookies.
import { createHandler } from '../../server/handler.js';
import { memoryStore } from '../../server/stores.js';

export const ORIGIN = 'https://gamefolk.test';
const CLIENT_ID = 'client-id.apps.googleusercontent.com';

function fakeIdToken(claims) {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none' })}.${part(claims)}.sig`;
}

// googleUser: what the fake Google says about whoever logs in next.
export function testServer({ now = () => Date.now() } = {}) {
  const store = memoryStore();
  const google = { user: { sub: 'google-1', email: 'player@example.com', email_verified: true }, lastNonce: null, overrides: {} };
  const fetchImpl = async (url, init) => {
    const params = new URLSearchParams(init.body);
    const claims = {
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      exp: Math.floor(now() / 1000) + 3600,
      nonce: google.lastNonce,
      ...google.user,
      ...google.overrides
    };
    if (params.get('code') !== 'good-code' || !params.get('code_verifier')) return new Response('{}', { status: 400 });
    return Response.json({ id_token: fakeIdToken(claims) });
  };
  const handler = createHandler({
    store,
    env: { GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: 'secret' },
    fetchImpl,
    now,
    google: { authUrl: 'https://google.test/auth' }
  });
  return { store, google, handler };
}

export function browser(server, userAgent = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130') {
  const jar = new Map();
  const remember = response => {
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const [name, value] = pair.split('=');
      if (attrs.some(a => a.trim() === 'Max-Age=0')) jar.delete(name);
      else jar.set(name, value);
    }
  };
  const fetchImpl = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set('user-agent', userAgent);
    if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const method = init.method || 'GET';
    if (method !== 'GET' && !headers.has('origin')) headers.set('origin', ORIGIN);
    const absolute = url.startsWith('http') ? url : `${ORIGIN}${url}`;
    const response = await server.handler(new Request(absolute, { ...init, method, headers }));
    remember(response);
    return response;
  };

  return {
    jar,
    fetch: fetchImpl,
    async login() {
      const start = await fetchImpl('/api/auth/google/start');
      const location = new URL(start.headers.get('location'));
      server.google.lastNonce = location.searchParams.get('nonce');
      const state = location.searchParams.get('state');
      const callback = await fetchImpl(`/api/auth/google/callback?code=good-code&state=${state}`);
      return callback.headers.get('location');
    }
  };
}
