import { useId, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { Avatar, ChipInput, Modal, WhenField } from './common.jsx';
import { useI18n } from '../app/i18n.js';
import { useApp } from '../app/context.js';
import { emptyPerson, fullName } from '../core/model.js';
import { knownGames, knownStatuses } from '../core/search.js';
import { go } from '../app/router.js';

export function PersonEditor({ person, onClose }) {
  const { t } = useI18n();
  const { data, ui } = useApp();
  const isNew = !person?.id;
  const [form, setForm] = useState(() => (person ? structuredClone(person) : emptyPerson()));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const photoInput = useRef(null);
  const ids = {
    first: useId(), last: useId(), status: useId(), statuses: useId(), games: useId(), gameList: useId(),
    note: useId(), met: useId(), metGame: useId(), when: useId()
  };

  const set = patch => setForm(current => ({ ...current, ...patch }));
  const setRow = (key, index, patch) => set({ [key]: form[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  const gameOptions = knownGames(data.people, data.stories);

  const onPhoto = async file => {
    if (!file) return;
    setBusy(true);
    try {
      set({ photo: await data.addPhoto(file) });
    } catch {
      setError(t('error.image', { name: file.name }));
    }
    setBusy(false);
  };

  const save = async () => {
    if (!form.firstName.trim()) return setError(t('personEditor.needName'));
    setBusy(true);
    try {
      const saved = await data.savePerson(form);
      onClose();
      if (isNew) go(`/people/${saved.id}`);
      ui.toast(t('person.saved', { name: fullName(saved) }), null, 'success');
    } catch {
      setError(t('error.storage'));
      setBusy(false);
    }
  };

  const remove = async () => {
    onClose();
    go('/people');
    const undo = await data.deletePerson(person.id);
    ui.toast(t('person.deleted'), undo);
  };

  const footer = (
    <>
      {!isNew && <button type="button" className="btn btn-danger" onClick={remove}><Icon name="trash" size={16} />{t('personEditor.delete')}</button>}
      <span className="grow" />
      <button type="button" className="btn" onClick={onClose}>{t('action.cancel')}</button>
      <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{t('personEditor.save')}</button>
    </>
  );

  return (
    <Modal title={isNew ? t('personEditor.newTitle') : t('personEditor.editTitle')} onClose={onClose} footer={footer} size="lg">
      <div className="form">
        <div className="photo-field">
          <Avatar person={form} size={64} />
          <button type="button" className="btn" onClick={() => photoInput.current?.click()} disabled={busy}>
            <Icon name="camera" size={16} />{t('person.addPhoto')}
          </button>
          {form.photo && <button type="button" className="link-btn" onClick={() => set({ photo: null })}>{t('person.removePhoto')}</button>}
          <input ref={photoInput} type="file" accept="image/*" hidden onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor={ids.first}>{t('personEditor.firstName')}</label>
            <input id={ids.first} value={form.firstName} maxLength={60} onChange={e => set({ firstName: e.target.value })} data-autofocus />
          </div>
          <div className="field">
            <label htmlFor={ids.last}>{t('personEditor.lastName')}</label>
            <input id={ids.last} value={form.lastName} maxLength={60} onChange={e => set({ lastName: e.target.value })} />
          </div>
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor={ids.status}>{t('personEditor.status')}</label>
            <input id={ids.status} value={form.status} list={ids.statuses} maxLength={40} placeholder={t('personEditor.statusPlaceholder')} onChange={e => set({ status: e.target.value })} />
            <datalist id={ids.statuses}>{knownStatuses(data.people, t('status.defaults')).map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="field">
            <label htmlFor={ids.games}>{t('personEditor.games')}</label>
            <ChipInput id={ids.games} values={form.games} placeholder={t('personEditor.gamesPlaceholder')} suggestions={gameOptions} onChange={games => set({ games })} />
          </div>
        </div>

        <fieldset className="field">
          <legend>{t('personEditor.nicks')}</legend>
          <datalist id={ids.gameList}>{gameOptions.map(g => <option key={g} value={g} />)}</datalist>
          {form.nicks.map((row, index) => (
            <div key={index} className="pair-row">
              <input aria-label={t('personEditor.nickGame')} placeholder={t('personEditor.nickGame')} list={ids.gameList} value={row.game} onChange={e => setRow('nicks', index, { game: e.target.value })} />
              <input aria-label={t('personEditor.nick')} placeholder={t('personEditor.nick')} value={row.nick} onChange={e => setRow('nicks', index, { nick: e.target.value })} />
              <button type="button" className="icon-btn" aria-label={t('personEditor.removeRow')} onClick={() => set({ nicks: form.nicks.filter((_, i) => i !== index) })}>
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="link-btn add-row" onClick={() => set({ nicks: [...form.nicks, { game: '', nick: '' }] })}>
            <Icon name="plus" size={16} />{t('personEditor.addNick')}
          </button>
        </fieldset>

        <fieldset className="field">
          <legend>{t('personEditor.contacts')}</legend>
          {form.contacts.map((row, index) => (
            <div key={index} className="pair-row">
              <input aria-label={t('personEditor.contactLabel')} placeholder="Discord, Steam, Telegram" value={row.label} onChange={e => setRow('contacts', index, { label: e.target.value })} />
              <input aria-label={t('personEditor.contactValue')} placeholder={t('personEditor.contactValue')} value={row.value} onChange={e => setRow('contacts', index, { value: e.target.value })} />
              <button type="button" className="icon-btn" aria-label={t('personEditor.removeRow')} onClick={() => set({ contacts: form.contacts.filter((_, i) => i !== index) })}>
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="link-btn add-row" onClick={() => set({ contacts: [...form.contacts, { label: '', value: '' }] })}>
            <Icon name="plus" size={16} />{t('personEditor.addContact')}
          </button>
        </fieldset>

        <fieldset className="field met-box">
          <legend>{t('personEditor.met')}</legend>
          <label htmlFor={ids.met} className="sr-only">{t('personEditor.met')}</label>
          <textarea id={ids.met} rows={3} value={form.met.text} placeholder={t('personEditor.metPlaceholder')} onChange={e => set({ met: { ...form.met, text: e.target.value } })} />
          <div className="field">
            <label htmlFor={ids.metGame}>{t('personEditor.metGame')}</label>
            <input id={ids.metGame} list={ids.gameList} value={form.met.game} onChange={e => set({ met: { ...form.met, game: e.target.value } })} />
          </div>
          <WhenField value={form.met.when} onChange={when => set({ met: { ...form.met, when } })} legendId={ids.when} />
        </fieldset>

        <div className="field">
          <label htmlFor={ids.note}>{t('personEditor.note')}</label>
          <textarea id={ids.note} rows={3} value={form.note} onChange={e => set({ note: e.target.value })} />
        </div>

        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
