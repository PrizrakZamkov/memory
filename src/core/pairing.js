// Moving the data key to a new device without the server being able to read it.
// The new device makes an ECDH key pair and shows a code made from its public key.
// The old device shows the same code, the user compares them and approves.
// The old device then wraps the data key with a secret only the new device can rebuild.
import { formatRecoveryKey } from './crypto.js';
import { fromBase64, toBase64 } from './encoding.js';

const subtle = globalThis.crypto.subtle;
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const AES = { name: 'AES-GCM', length: 256 };

async function sha256(bytes) {
  return new Uint8Array(await subtle.digest('SHA-256', bytes));
}

// 8 characters, 40 bits: far too many to fake while the request is alive.
export async function pairingCode(publicKeyB64) {
  return formatRecoveryKey((await sha256(fromBase64(publicKeyB64))).slice(0, 5));
}

async function sharedKey(privateKey, otherPublicB64, requesterB64, approverB64) {
  const other = await subtle.importKey('raw', fromBase64(otherPublicB64), ECDH, false, []);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: other }, privateKey, 256);
  const base = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const salt = await sha256(new TextEncoder().encode(requesterB64 + approverB64));
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('gamefolk-pairing') },
    base, AES, false, ['wrapKey', 'unwrapKey']
  );
}

export async function startPairing() {
  const keyPair = await subtle.generateKey(ECDH, false, ['deriveBits']);
  const publicKey = toBase64(new Uint8Array(await subtle.exportKey('raw', keyPair.publicKey)));
  return { keyPair, publicKey, code: await pairingCode(publicKey) };
}

export async function approvePairing(requesterPublicKey, dataKey) {
  const own = await subtle.generateKey(ECDH, false, ['deriveBits']);
  const publicKey = toBase64(new Uint8Array(await subtle.exportKey('raw', own.publicKey)));
  const key = await sharedKey(own.privateKey, requesterPublicKey, requesterPublicKey, publicKey);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await subtle.wrapKey('raw', dataKey, key, { name: 'AES-GCM', iv }));
  return { publicKey, wrapped: { iv: toBase64(iv), data: toBase64(data) } };
}

export async function finishPairing(pairing, response) {
  const key = await sharedKey(pairing.keyPair.privateKey, response.publicKey, pairing.publicKey, response.publicKey);
  return subtle.unwrapKey(
    'raw', fromBase64(response.wrapped.data), key,
    { name: 'AES-GCM', iv: fromBase64(response.wrapped.iv) },
    AES, true, ['encrypt', 'decrypt']
  );
}
