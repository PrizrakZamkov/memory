// Thin wrappers around WebCrypto. Works in browsers and in Node 20+.
const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const PASSCODE_ITERATIONS = 600000;
const AES = { name: 'AES-GCM', length: 256 };

export function randomBytes(length) {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

export function generateDataKey() {
  // Extractable so it can be wrapped by the device, passcode and recovery keys.
  return subtle.generateKey(AES, true, ['encrypt', 'decrypt']);
}

export function generateDeviceKey() {
  // Never leaves the browser: it cannot be exported, only used.
  return subtle.generateKey(AES, false, ['wrapKey', 'unwrapKey']);
}

export async function keyFromPasscode(passcode, salt, iterations = PASSCODE_ITERATIONS) {
  const base = await subtle.importKey('raw', encoder.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, AES, false, ['wrapKey', 'unwrapKey']
  );
}

export async function keyFromRecovery(recoveryBytes, salt) {
  // The recovery key is 160 random bits, so a fast KDF is enough here.
  const base = await subtle.importKey('raw', recoveryBytes, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', salt, info: encoder.encode('gamefolk-recovery'), hash: 'SHA-256' },
    base, AES, false, ['wrapKey', 'unwrapKey']
  );
}

export async function wrapKey(dataKey, wrappingKey) {
  const iv = randomBytes(12);
  const data = new Uint8Array(await subtle.wrapKey('raw', dataKey, wrappingKey, { name: 'AES-GCM', iv }));
  return { iv, data };
}

export function unwrapKey(box, wrappingKey) {
  return subtle.unwrapKey(
    'raw', box.data, wrappingKey, { name: 'AES-GCM', iv: box.iv },
    AES, true, ['encrypt', 'decrypt']
  );
}

export async function encryptBytes(key, bytes, label = '') {
  const iv = randomBytes(12);
  const data = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(label) }, key, bytes
  );
  return { iv, data: new Uint8Array(data) };
}

export async function decryptBytes(key, box, label = '') {
  const data = await subtle.decrypt(
    { name: 'AES-GCM', iv: box.iv, additionalData: encoder.encode(label) }, key, box.data
  );
  return new Uint8Array(data);
}

// The label binds a record to its id, so encrypted records cannot be swapped.
export function encryptJson(key, value, label = '') {
  return encryptBytes(key, encoder.encode(JSON.stringify(value)), label);
}

export async function decryptJson(key, box, label = '') {
  return JSON.parse(decoder.decode(await decryptBytes(key, box, label)));
}

// Crockford base32: no I, L, O, U, so the key is easy to read and type.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newRecoveryBytes() {
  return randomBytes(20);
}

export function formatRecoveryKey(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out.match(/.{1,4}/g).join('-');
}

export function parseRecoveryKey(text) {
  const clean = String(text || '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (clean.length !== 32) return null;
  const bytes = new Uint8Array(20);
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const char of clean) {
    const digit = ALPHABET.indexOf(char);
    if (digit === -1) return null;
    value = ((value << 5) | digit) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return bytes;
}
