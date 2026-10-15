// Storage adapters with one small interface:
// getJSON, getJSONWithEtag, setJSON(key, value, { onlyIfNew, onlyIfMatch }), delete, list(prefix).

// Netlify Blobs. Strong consistency so a write is visible to the next request at once.
export function netlifyStore(getStore) {
  const store = getStore({ name: 'gamefolk', consistency: 'strong' });
  return {
    getJSON: key => store.get(key, { type: 'json' }),
    async getJSONWithEtag(key) {
      const found = await store.getWithMetadata(key, { type: 'json' });
      return found ? { value: found.data, etag: found.etag } : null;
    },
    async setJSON(key, value, options = {}) {
      const result = await store.setJSON(key, value, options);
      return { modified: result?.modified !== false, etag: result?.etag };
    },
    delete: key => store.delete(key),
    async list(prefix) {
      const { blobs } = await store.list({ prefix });
      return blobs.map(({ key, etag }) => ({ key, etag }));
    }
  };
}

// In memory, for tests and local runs.
export function memoryStore() {
  const map = new Map();
  let counter = 0;
  return {
    map,
    async getJSON(key) {
      return map.has(key) ? JSON.parse(map.get(key).text) : null;
    },
    async getJSONWithEtag(key) {
      const item = map.get(key);
      return item ? { value: JSON.parse(item.text), etag: item.etag } : null;
    },
    async setJSON(key, value, { onlyIfNew, onlyIfMatch } = {}) {
      const item = map.get(key);
      if (onlyIfNew && item) return { modified: false };
      if (onlyIfMatch && item?.etag !== onlyIfMatch) return { modified: false };
      const etag = `"${++counter}"`;
      map.set(key, { text: JSON.stringify(value), etag });
      return { modified: true, etag };
    },
    async delete(key) {
      map.delete(key);
    },
    async list(prefix) {
      return [...map.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, item]) => ({ key, etag: item.etag }));
    }
  };
}
