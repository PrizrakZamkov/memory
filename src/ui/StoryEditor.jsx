import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { Avatar, ChipInput, Modal, SecureImage, WhenField } from './common.jsx';
import { useI18n } from '../app/i18n.js';
import { useApp } from '../app/context.js';
import { emptyStory, fullName, MAX_IMAGES, MAX_RANDOM_PLAYERS } from '../core/model.js';
import { knownGames, knownTags, suggestPeople } from '../core/search.js';
import { todayIso } from '../core/dates.js';

const hasContent = form =>
  Boolean(form.title.trim() || form.text.trim() || form.people.length || form.names.length || form.images.length);

function freshStory(presetPerson) {
  return { ...emptyStory(), when: { kind: 'exact', date: todayIso() }, people: presetPerson ? [presetPerson] : [] };
}

export function StoryEditor({ story, presetPerson, onClose }) {
  const { t } = useI18n();
  const { data, ui } = useApp();
  const isNew = !story?.id;
  // Drafts are kept only for a plain new story, so other flows never overwrite them.
  const usesDraft = isNew && !presetPerson;
  const [form, setForm] = useState(() => (story ? { ...story } : freshStory(presetPerson)));
  const [draftNote, setDraftNote] = useState('');
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const restoring = useRef(usesDraft);
  const fileInput = useRef(null);
  const ids = { who: useId(), title: useId(), text: useId(), game: useId(), tags: useId(), when: useId(), games: useId() };

  const set = patch => setForm(current => ({ ...current, ...patch }));

  useEffect(() => {
    if (!usesDraft) return;
    data.loadDraft().then(draft => {
      if (draft && hasContent(draft)) {
        setForm({ ...freshStory(), ...draft });
        setDraftNote('restored');
      }
      restoring.current = false;
    });
  }, []);

  useEffect(() => {
    if (!usesDraft || restoring.current || !hasContent(form)) return;
    const timer = setTimeout(() => {
      data.saveDraft(form).then(() => setDraftNote(note => note || 'saved'));
    }, 600);
    return () => clearTimeout(timer);
  }, [form]);

  const suggestions = suggestPeople(data.people, who, form.people);
  const typed = who.trim();

  const addPerson = id => {
    set({ people: [...form.people, id] });
    setWho('');
  };
  const addName = () => {
    if (typed && !form.names.includes(typed)) set({ names: [...form.names, typed] });
    setWho('');
  };
  const createPerson = async () => {
    const [firstName, ...rest] = typed.split(/\s+/);
    const person = await data.savePerson({ firstName, lastName: rest.join(' '), games: form.game ? [form.game] : [] });
    addPerson(person.id);
  };

  const onWhoKey = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (suggestions[0]) addPerson(suggestions[0].person.id);
      else if (typed) addName();
    } else if (event.key === 'Backspace' && !who) {
      if (form.names.length) set({ names: form.names.slice(0, -1) });
      else if (form.people.length) set({ people: form.people.slice(0, -1) });
    }
  };

  const onFiles = async files => {
    const room = MAX_IMAGES - form.images.length;
    const picked = [...files].filter(f => f.type.startsWith('image/')).slice(0, room);
    if (!picked.length) return;
    setBusy(true);
    setError('');
    const { images, failed } = await data.addStoryImages(picked);
    setForm(current => ({ ...current, images: [...current.images, ...images].slice(0, MAX_IMAGES) }));
    setBusy(false);
    if (failed.length) setError(t('error.image', { name: failed.join(', ') }));
  };

  const save = async () => {
    if (!form.title.trim() && !form.text.trim()) return setError(t('editor.needContent'));
    const title = form.title.trim() || form.text.trim().split('\n')[0].slice(0, 80);
    setBusy(true);
    try {
      await data.saveStory({ ...form, title });
      if (usesDraft) await data.clearDraft();
      onClose();
    } catch {
      setError(t('error.storage'));
      setBusy(false);
    }
  };

  const remove = async () => {
    onClose();
    const undo = await data.deleteStory(story.id);
    ui.toast(t('story.deleted'), undo);
  };

  const clearDraft = async () => {
    await data.clearDraft();
    setForm(freshStory());
    setDraftNote('');
  };

  const footer = (
    <>
      {!isNew && (
        <button type="button" className="btn btn-danger" onClick={remove}><Icon name="trash" size={16} />{t('editor.deleteStory')}</button>
      )}
      {usesDraft && draftNote && (
        <span className="draft-note" role="status">
          {t(draftNote === 'restored' ? 'editor.draftRestored' : 'editor.draftSaved')}
          {draftNote === 'restored' && <button type="button" className="link-btn" onClick={clearDraft}>{t('editor.clearDraft')}</button>}
        </span>
      )}
      <span className="grow" />
      <button type="button" className="btn" onClick={onClose}>{t('action.cancel')}</button>
      <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{t('editor.save')}</button>
    </>
  );

  return (
    <Modal title={isNew ? t('editor.newTitle') : t('editor.editTitle')} onClose={onClose} footer={footer} size="lg">
      <div className="form">
        <div className="field">
          <label htmlFor={ids.who}>{t('editor.who')}</label>
          <div className="chip-field">
            {form.people.map(id => {
              const person = data.peopleById.get(id);
              if (!person) return null;
              return (
                <span key={id} className="chip chip-person">
                  <Avatar person={person} size={24} />{fullName(person)}
                  <button type="button" className="chip-x" aria-label={t('editor.removePerson', { name: fullName(person) })} onClick={() => set({ people: form.people.filter(x => x !== id) })}>
                    <Icon name="close" size={12} strokeWidth={2.5} />
                  </button>
                </span>
              );
            })}
            {form.names.map(name => (
              <span key={name} className="chip chip-name">
                {name}
                <button type="button" className="chip-x" aria-label={t('editor.removePerson', { name })} onClick={() => set({ names: form.names.filter(x => x !== name) })}>
                  <Icon name="close" size={12} strokeWidth={2.5} />
                </button>
              </span>
            ))}
            <input id={ids.who} value={who} placeholder={t('editor.whoPlaceholder')} autoComplete="off" onChange={e => setWho(e.target.value)} onKeyDown={onWhoKey} data-autofocus />
          </div>
          {typed && (
            <div className="suggestions" role="group" aria-label={t('editor.suggestions')}>
              {suggestions.map(({ person, nick }) => (
                <button key={person.id} type="button" className="suggestion" onClick={() => addPerson(person.id)}>
                  <Avatar person={person} size={26} />
                  <span className="grow">{fullName(person)}</span>
                  {nick && <span className="muted">{nick.nick}{nick.game ? `, ${nick.game}` : ''}</span>}
                </button>
              ))}
              <button type="button" className="suggestion" onClick={createPerson}>
                <Icon name="plus" size={18} />{t('editor.createPerson', { name: typed })}
              </button>
              <button type="button" className="suggestion" onClick={addName}>
                <Icon name="feed" size={18} />{t('editor.addName', { name: typed })}
              </button>
            </div>
          )}
          <div className="counter">
            <span id={`${ids.who}-random`} className="muted grow">{t('editor.random')}</span>
            <button type="button" className="icon-btn bordered" aria-label={t('editor.randomLess')} onClick={() => set({ randomPlayers: Math.max(0, form.randomPlayers - 1) })}>
              <Icon name="minus" size={14} strokeWidth={2.5} />
            </button>
            <output aria-labelledby={`${ids.who}-random`}>{form.randomPlayers}</output>
            <button type="button" className="icon-btn bordered" aria-label={t('editor.randomMore')} onClick={() => set({ randomPlayers: Math.min(MAX_RANDOM_PLAYERS, form.randomPlayers + 1) })}>
              <Icon name="plus" size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor={ids.title}>{t('editor.title')}</label>
          <input id={ids.title} value={form.title} maxLength={200} placeholder={t('editor.titlePlaceholder')} onChange={e => set({ title: e.target.value })} />
        </div>

        <div className="field">
          <label htmlFor={ids.text}>{t('editor.text')}</label>
          <textarea id={ids.text} rows={6} value={form.text} onChange={e => set({ text: e.target.value })} />
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor={ids.game}>{t('editor.game')}</label>
            <input id={ids.game} value={form.game} list={ids.games} maxLength={80} onChange={e => set({ game: e.target.value })} />
            <datalist id={ids.games}>{knownGames(data.people, data.stories).map(g => <option key={g} value={g} />)}</datalist>
          </div>
          <div className="field">
            <label htmlFor={ids.tags}>{t('editor.tags')}</label>
            <ChipInput id={ids.tags} values={form.tags} prefix="#" placeholder={t('editor.tagsPlaceholder')} suggestions={knownTags(data.stories)} onChange={tags => set({ tags })} />
          </div>
        </div>

        <WhenField value={form.when} onChange={when => set({ when })} legendId={ids.when} />

        <div className="field">
          <span className="field-label">{t('editor.images')}</span>
          <div className="image-grid">
            {form.images.map((image, index) => (
              <div key={image.id} className="image-tile">
                <SecureImage id={`${image.id}.thumb`} className="thumb-img" />
                <button type="button" className="tile-x" aria-label={t('editor.removeImage', { index: index + 1 })} onClick={() => set({ images: form.images.filter(x => x.id !== image.id) })}>
                  <Icon name="close" size={14} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            {form.images.length < MAX_IMAGES && (
              <button type="button" className="image-add" onClick={() => fileInput.current?.click()} disabled={busy}>
                <Icon name="image" size={22} />
                <span>{busy ? t('editor.processing') : t('editor.addImages')}</span>
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e => { onFiles(e.target.files); e.target.value = ''; }} />
          <p className="hint">{t('editor.imagesHint')}</p>
        </div>

        <label className="check">
          <input type="checkbox" checked={form.starred} onChange={e => set({ starred: e.target.checked })} />
          <span>{t('editor.starred')}</span>
        </label>

        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
