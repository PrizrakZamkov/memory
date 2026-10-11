// Small promise wrapper over IndexedDB with three stores:
// meta (vault and draft), records (people and stories), blobs (images).
const DB_NAME = 'gamefolk';
const STORES = ['meta', 'records', 'blobs'];

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function openDb() {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => {
    for (const name of STORES) open.result.createObjectStore(name);
  };
  const idb = await request(open);

  const store = (name, mode) => idb.transaction(name, mode).objectStore(name);

  return {
    get: (name, key) => request(store(name, 'readonly').get(key)),
    put: (name, key, value) => request(store(name, 'readwrite').put(value, key)),
    delete: (name, key) => request(store(name, 'readwrite').delete(key)),
    async entries(name) {
      const s = store(name, 'readonly');
      const [keys, values] = await Promise.all([request(s.getAllKeys()), request(s.getAll())]);
      return keys.map((key, i) => [key, values[i]]);
    },
    async wipe() {
      for (const name of STORES) await request(store(name, 'readwrite').clear());
    }
  };
}

// Asks the browser not to clear our data when disk space runs low.
export async function askPersistentStorage() {
  try {
    return await navigator.storage?.persist?.();
  } catch {
    return false;
  }
}
