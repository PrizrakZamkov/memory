// Base64 helpers that work the same in browsers and in Node.
export function toBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function fromBase64(text) {
  const binary = atob(String(text));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function boxToJson(box) {
  return { iv: toBase64(box.iv), data: toBase64(box.data) };
}

export function boxFromJson(json) {
  return { iv: fromBase64(json.iv), data: fromBase64(json.data) };
}
