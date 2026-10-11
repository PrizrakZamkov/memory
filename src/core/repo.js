// Encrypted storage for people, stories, images and the story draft.
import { decryptBytes, decryptJson, encryptBytes, encryptJson } from './crypto.js';

export function createRepo(db, key) {
  return {
    async loadAll() {
      const people = [];
      const stories = [];
      for (const [id, row] of await db.entries('records')) {
        const item = await decryptJson(key, row.box, `${row.kind}:${id}`);
        if (row.kind === 'person') people.push(item);
        else stories.push(item);
      }
      return { people, stories };
    },

    async save(kind, item) {
      const box = await encryptJson(key, item, `${kind}:${item.id}`);
      await db.put('records', item.id, { kind, box });
    },

    async remove(id) {
      await db.delete('records', id);
    },

    async saveImage(id, bytes, type) {
      const box = await encryptBytes(key, bytes, `image:${id}`);
      await db.put('blobs', id, { type, box });
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

    // Deletes image blobs that no story or person points to any more.
    async removeUnusedImages(people, stories, draft) {
      const used = new Set();
      for (const person of people) if (person.photo) used.add(person.photo);
      for (const story of [...stories, ...(draft ? [draft] : [])]) {
        for (const image of story.images || []) {
          used.add(image.id);
          used.add(`${image.id}.thumb`);
        }
      }
      for (const [id] of await db.entries('blobs')) {
        if (!used.has(id)) await db.delete('blobs', id);
      }
    }
  };
}
