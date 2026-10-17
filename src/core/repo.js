// Encrypted storage for people, stories, images and the story draft.
// Every record row carries `t`, the time of the last change, so devices can sync.
// A deleted record stays as a small tombstone row, so the deletion reaches other devices too.
import { decryptBytes, decryptJson, encryptBytes, encryptJson } from './crypto.js';

export function createRepo(db, key, onChange = () => {}) {
  return {
    async loadAll() {
      const people = [];
      const stories = [];
      let damaged = 0;
      for (const [id, row] of await db.entries('records')) {
        if (row.deleted) continue;
        // One damaged record must not lock the user out of all the others.
        // It stays in storage untouched, so a later backup or sync can still fix it.
        let item;
        try {
          item = { ...(await decryptJson(key, row.box, `${row.kind}:${id}`)), id };
        } catch {
          damaged++;
          continue;
        }
        if (row.kind === 'person') people.push(item);
        else if (row.kind === 'story') stories.push(item);
      }
      if (damaged) console.warn(`Gamefolk: ${damaged} records could not be decrypted and were skipped`);
      return { people, stories, damaged };
    },

    async save(kind, item) {
      const box = await encryptJson(key, item, `${kind}:${item.id}`);
      await db.put('records', item.id, { kind, box, t: Date.now() });
      onChange();
    },

    async remove(id) {
      const row = await db.get('records', id);
      if (!row) return;
      await db.put('records', id, { kind: row.kind, deleted: true, t: Date.now() });
      onChange();
    },

    async saveImage(id, bytes, type) {
      const box = await encryptBytes(key, bytes, `image:${id}`);
      await db.put('blobs', id, { type, box });
      onChange();
    },

    async loadImage(id) {
      const row = await db.get('blobs', id);
      if (!row) return null;
      return { type: row.type, bytes: await decryptBytes(key, row.box, `image:${id}`) };
    },

    async loadDraft() {
      const box = await db.get('meta', 'draft');
      return box ? decryptJson(key, box, 'draft') : null;
    },

    async saveDraft(draft) {
      await db.put('meta', 'draft', await encryptJson(key, draft, 'draft'));
    },

    async clearDraft() {
      await db.delete('meta', 'draft');
    },

    async loadProfile() {
      const box = await db.get('meta', 'profile');
      return box ? decryptJson(key, box, 'profile') : {};
    },

    async saveProfile(profile) {
      await db.put('meta', 'profile', await encryptJson(key, profile, 'profile'));
    },

    // Deletes image blobs that no story or person points to any more.
    // Returns the deleted ids, so the server copies can be removed as well.
    async removeUnusedImages(people, stories, draft) {
      const used = usedImageIds(people, [...stories, ...(draft ? [draft] : [])]);
      const removed = [];
      for (const [id] of await db.entries('blobs')) {
        if (!used.has(id)) {
          await db.delete('blobs', id);
          removed.push(id);
        }
      }
      return removed;
    }
  };
}

export function usedImageIds(people, stories) {
  const used = new Set();
  for (const person of people) if (person.photo) used.add(person.photo);
  for (const story of stories) {
    for (const image of story.images || []) {
      used.add(image.id);
      used.add(`${image.id}.thumb`);
    }
  }
  return used;
}
