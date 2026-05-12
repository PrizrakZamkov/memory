import { createCipheriv, createDecipheriv, randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';

const scryptAsync = promisify(scrypt);

function appKey() {
  if (!config.encryptionKey || config.encryptionKey.includes('replace-with')) {
    if (config.env === 'production') throw new Error('APP_ENCRYPTION_KEY is required in production');
    return createHash('sha256').update('dev-only-storyline-key').digest();
  }
  const decoded = Buffer.from(config.encryptionKey, 'base64');
  if (decoded.length === 32) return decoded;
  return createHash('sha256').update(config.encryptionKey).digest();
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt.toString('base64')}$${Buffer.from(hash).toString('base64')}`;
}

export async function verifyPassword(password, encoded) {
  const [kind, saltB64, hashB64] = String(encoded || '').split('$');
  if (kind !== 'scrypt' || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, salt, expected.length, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function encryptText(value) {
  if (!value) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', appKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptText(value) {
  if (!value) return '';
  const [version, ivB64, tagB64, dataB64] = String(value).split(':');
  if (version !== 'v1') return value;
  const decipher = createDecipheriv('aes-256-gcm', appKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

export function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}
