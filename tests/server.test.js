import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browser, ORIGIN, testServer } from './helpers/server-client.js';

const json = { 'Content-Type': 'application/json', 'X-Requested-With': 'gamefolk' };
const box = { iv: 'AAAAAAAAAAAAAAAA', data: 'c2VjcmV0' };

test('login sets a strict http-only session cookie and works with Google claims', async () => {
  const server = testServer();
  const client = browser(server);
  const start = await client.fetch('/api/auth/google/start');
  assert.equal(start.status, 302);
  const location = new URL(start.headers.get('location'));
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(location.searchParams.get('state') && location.searchParams.get('nonce'));
  assert.match(start.headers.getSetCookie()[0], /^__Host-gf_oauth=.*HttpOnly; Secure; SameSite=Lax/);

  server.google.lastNonce = location.searchParams.get('nonce');
  const callback = await client.fetch(`/api/auth/google/callback?code=good-code&state=${location.searchParams.get('state')}`);
  assert.equal(callback.headers.get('location'), '/?login=ok');
  assert.ok(callback.headers.getSetCookie().some(c => /^__Host-gf_session=.+HttpOnly; Secure; SameSite=Strict/.test(c)));

  const me = await (await client.fetch('/api/me')).json();
  assert.equal(me.email, 'player@example.com');
  assert.equal(me.hasVault, false);
});

test('login fails on wrong state, wrong nonce, other audience or unverified email', async () => {
  const server = testServer();
  const client = browser(server);
  const start = await client.fetch('/api/auth/google/start');
  server.google.lastNonce = new URL(start.headers.get('location')).searchParams.get('nonce');
  const bad = await client.fetch('/api/auth/google/callback?code=good-code&state=forged');
  assert.equal(bad.headers.get('location'), '/?login=failed');

  for (const overrides of [{ nonce: 'other' }, { aud: 'someone-else' }, { email_verified: false }, { iss: 'https://evil.test' }]) {
    const c = browser(server);
    server.google.overrides = overrides;
    assert.equal(await c.login(), '/?login=failed');
  }
  server.google.overrides = {};
  assert.equal((await client.fetch('/api/me')).status, 401);
});

test('writes need the same origin and the custom header', async () => {
  const server = testServer();
  const client = browser(server);
  await client.login();
  const evil = await client.fetch('/api/vault', { method: 'PUT', headers: { ...json, origin: 'https://evil.test' }, body: '{}' });
  assert.equal(evil.status, 403);
  const noHeader = await client.fetch('/api/vault', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(noHeader.status, 403);
});

test('records follow last-write-wins and are isolated between accounts', async () => {
  const server = testServer();
  const alice = browser(server);
  await alice.login();
  const put = (client, t) => client.fetch('/api/records/r1', { method: 'PUT', headers: json, body: JSON.stringify({ kind: 'story', t, box }) });
  assert.equal((await put(alice, 1000)).status, 200);
  assert.equal((await put(alice, 900)).status, 409);
  assert.equal((await put(alice, 1100)).status, 200);

  server.google.user = { sub: 'google-2', email: 'bob@example.com', email_verified: true };
  const bob = browser(server);
  await bob.login();
  const list = await (await bob.fetch('/api/records')).json();
  assert.deepEqual(list.records, []);
  const fetched = await (await bob.fetch('/api/records/fetch', { method: 'POST', headers: json, body: JSON.stringify({ ids: ['r1'] }) })).json();
  assert.deepEqual(fetched.records, []);
});

test('bad input is rejected', async () => {
  const server = testServer();
  const client = browser(server);
  await client.login();
  const put = body => client.fetch('/api/records/r1', { method: 'PUT', headers: json, body: JSON.stringify(body) });
  assert.equal((await put({ kind: 'admin', t: 1, box })).status, 400);
  assert.equal((await put({ kind: 'story', t: 1, box: { iv: 'x', data: '!!' } })).status, 400);
  assert.equal((await put({ kind: 'story', t: Date.now() + 10 * 86400000, box })).status, 400);
  const badId = await client.fetch('/api/records/..%2Fsess', { method: 'PUT', headers: json, body: JSON.stringify({ kind: 'story', t: 1, box }) });
  assert.equal(badId.status, 400);
  const broken = await client.fetch('/api/records/r1', { method: 'PUT', headers: json, body: '{nope' });
  assert.equal(broken.status, 400);
});

test('vault header can be set only once', async () => {
  const server = testServer();
  const client = browser(server);
  await client.login();
  const header = { recovery: { salt: 'AAAAAAAAAAAAAAAAAAAAAA==', ...box }, recoveryText: box };
  const first = await client.fetch('/api/vault', { method: 'PUT', headers: json, body: JSON.stringify(header) });
  assert.equal(first.status, 201);
  const second = await client.fetch('/api/vault', { method: 'PUT', headers: json, body: JSON.stringify(header) });
  assert.equal(second.status, 409);
  assert.equal((await (await client.fetch('/api/me')).json()).hasVault, true);
});

test('pairing passes only public keys and a wrapped key, and only to the asking device', async () => {
  const server = testServer();
  const oldDevice = browser(server);
  const newDevice = browser(server, 'Mozilla/5.0 (Linux; Android 14) Chrome/130');
  await oldDevice.login();
  await newDevice.login();
  const key = 'B'.repeat(87) + '=';
  const created = await (await newDevice.fetch('/api/pairing', { method: 'POST', headers: json, body: JSON.stringify({ publicKey: key }) })).json();

  const own = await (await newDevice.fetch('/api/pairing')).json();
  assert.equal(own.requests.length, 0);
  const seen = await (await oldDevice.fetch('/api/pairing')).json();
  assert.equal(seen.requests[0].deviceName, 'Chrome, Android');

  const selfApprove = await newDevice.fetch(`/api/pairing/${created.id}/approve`, { method: 'POST', headers: json, body: JSON.stringify({ publicKey: key, wrapped: box }) });
  assert.equal(selfApprove.status, 403);
  const approve = await oldDevice.fetch(`/api/pairing/${created.id}/approve`, { method: 'POST', headers: json, body: JSON.stringify({ publicKey: key, wrapped: box }) });
  assert.equal(approve.status, 200);
  assert.equal((await oldDevice.fetch(`/api/pairing/${created.id}`)).status, 403);

  const result = await (await newDevice.fetch(`/api/pairing/${created.id}`)).json();
  assert.equal(result.status, 'approved');
  assert.deepEqual(result.response.wrapped, box);
  assert.equal((await newDevice.fetch(`/api/pairing/${created.id}`)).status, 404);
});

test('devices can be signed out, and deleting the account removes everything', async () => {
  const server = testServer();
  const a = browser(server);
  const b = browser(server);
  await a.login();
  await b.login();
  const { devices } = await (await a.fetch('/api/devices')).json();
  assert.equal(devices.length, 2);
  const other = devices.find(d => !d.current);
  await a.fetch(`/api/devices/${other.id}`, { method: 'DELETE', headers: json });
  assert.equal((await b.fetch('/api/me')).status, 401);

  await a.fetch('/api/records/r1', { method: 'PUT', headers: json, body: JSON.stringify({ kind: 'story', t: 1, box }) });
  await a.fetch('/api/account', { method: 'DELETE', headers: json });
  assert.equal(server.store.map.size, 0);
  assert.equal((await a.fetch('/api/me')).status, 401);
});

test('expired sessions are refused', async () => {
  let clock = Date.now();
  const server = testServer({ now: () => clock });
  const client = browser(server);
  await client.login();
  assert.equal((await client.fetch('/api/me')).status, 200);
  clock += 31 * 86400000;
  assert.equal((await client.fetch('/api/me')).status, 401);
});

test('api responses are never cached', async () => {
  const server = testServer();
  const response = await browser(server).fetch('/api/me');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(ORIGIN);
});
