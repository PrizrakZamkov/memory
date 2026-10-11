// In-memory stand-in for the IndexedDB wrapper, used by tests.
export function memoryDb() {
  const stores = { meta: new Map(), records: new Map(), blobs: new Map() };
  return {
    stores,
    async get(name, key) { return stores[name].get(key); },
    async put(name, key, value) { stores[name].set(key, value); },
    async delete(name, key) { stores[name].delete(key); },
    async entries(name) { return [...stores[name].entries()]; },
    async wipe() { for (const s of Object.values(stores)) s.clear(); }
  };
}
