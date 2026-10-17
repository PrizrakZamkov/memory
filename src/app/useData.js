// People and stories in memory, kept in sync with the encrypted storage.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRepo } from '../core/repo.js';
import { cleanPerson, cleanStory, newId } from '../core/model.js';
import { preparePhoto, prepareStoryImage } from '../core/images.js';
import { sampleData } from '../core/sample.js';

const upsert = (list, item) => {
  const index = list.findIndex(x => x.id === item.id);
  if (index === -1) return [item, ...list];
  const copy = [...list];
  copy[index] = item;
  return copy;
};

const without = (list, id) => list.filter(x => x.id !== id);

// hooks is a ref with optional callbacks from sync: onChange, fetchImage(id), onImagesRemoved(ids).
export function useData(db, dataKey, hooks = { current: {} }) {
  const repo = useMemo(() => createRepo(db, dataKey, () => hooks.current.onChange?.()), [db, dataKey]);
  const [people, setPeople] = useState([]);
  const [stories, setStories] = useState([]);
  const [profile, setProfile] = useState({});
  const [loaded, setLoaded] = useState(false);
  const latest = useRef({ people, stories });
  latest.current = { people, stories };
  const imageUrls = useRef(new Map());

  const reload = useCallback(async () => {
    const all = await repo.loadAll();
    setPeople(all.people);
    setStories(all.stories);
    return all;
  }, [repo]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const all = await repo.loadAll();
      if (!alive) return;
      setPeople(all.people);
      setStories(all.stories);
      setProfile(await repo.loadProfile());
      setLoaded(true);
      const draft = await repo.loadDraft();
      // With damaged records we cannot tell which images are still used, so keep them all.
      const removed = all.damaged ? [] : await repo.removeUnusedImages(all.people, all.stories, draft).catch(() => []);
      if (removed.length) hooks.current.onImagesRemoved?.(removed);
    })();
    const urls = imageUrls.current;
    return () => {
      alive = false;
      for (const promise of urls.values()) promise.then(url => url && URL.revokeObjectURL(url));
      urls.clear();
    };
  }, [repo]);

  const peopleById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  const saveStory = useCallback(async input => {
    const story = cleanStory(input);
    await repo.save('story', story);
    setStories(list => upsert(list, story));
    return story;
  }, [repo]);

  const savePerson = useCallback(async input => {
    const person = cleanPerson(input);
    await repo.save('person', person);
    setPeople(list => upsert(list, person));
    return person;
  }, [repo]);

  // Deletes right away and returns a function that brings the item back.
  const deleteStory = useCallback(async id => {
    const story = latest.current.stories.find(s => s.id === id);
    await repo.remove(id);
    setStories(list => without(list, id));
    return async () => {
      await repo.save('story', story);
      setStories(list => upsert(list, story));
    };
  }, [repo]);

  const deletePerson = useCallback(async id => {
    const person = latest.current.people.find(p => p.id === id);
    await repo.remove(id);
    setPeople(list => without(list, id));
    return async () => {
      await repo.save('person', person);
      setPeople(list => upsert(list, person));
    };
  }, [repo]);

  const addStoryImages = useCallback(async files => {
    const images = [];
    const failed = [];
    for (const file of files) {
      try {
        const { full, thumb } = await prepareStoryImage(file);
        const id = newId();
        await repo.saveImage(id, full.bytes, full.type);
        await repo.saveImage(`${id}.thumb`, thumb.bytes, thumb.type);
        images.push({ id, width: full.width, height: full.height });
      } catch {
        failed.push(file.name);
      }
    }
    return { images, failed };
  }, [repo]);

  const addPhoto = useCallback(async file => {
    const photo = await preparePhoto(file);
    const id = newId();
    await repo.saveImage(id, photo.bytes, photo.type);
    return id;
  }, [repo]);

  // Loads an image, downloading it from the sync server if this device does not have it yet.
  const loadImage = useCallback(async id => {
    let image = await repo.loadImage(id);
    if (!image && hooks.current.fetchImage) {
      await hooks.current.fetchImage(id);
      image = await repo.loadImage(id);
    }
    return image;
  }, [repo]);

  // Decrypts an image once and keeps an object URL until the vault closes.
  const imageUrl = useCallback(id => {
    const cache = imageUrls.current;
    if (!cache.has(id)) {
      const promise = loadImage(id)
        .then(image => (image ? URL.createObjectURL(new Blob([image.bytes], { type: image.type })) : null))
        .catch(() => null);
      // A failed download may work later, so it is not cached.
      promise.then(url => { if (!url) cache.delete(id); });
      cache.set(id, promise);
    }
    return cache.get(id);
  }, [loadImage]);

  const saveProfile = useCallback(async next => {
    await repo.saveProfile(next);
    setProfile(next);
  }, [repo]);

  const addSample = useCallback(async lang => {
    const sample = sampleData(lang);
    for (const person of sample.people) await repo.save('person', person);
    for (const story of sample.stories) await repo.save('story', story);
    setPeople(list => [...sample.people, ...list]);
    setStories(list => [...sample.stories, ...list]);
  }, [repo]);

  return {
    loaded, people, stories, peopleById, profile, reload, saveProfile, repo,
    saveStory, savePerson, deleteStory, deletePerson,
    toggleStar: story => saveStory({ ...story, starred: !story.starred }),
    addStoryImages, addPhoto, imageUrl, loadImage, addSample,
    loadDraft: () => repo.loadDraft(),
    saveDraft: draft => repo.saveDraft(draft),
    clearDraft: () => repo.clearDraft()
  };
}
