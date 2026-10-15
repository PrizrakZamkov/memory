// Small shared pieces: avatar, encrypted image, modal, toast, chip input, date picker.
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { useI18n } from '../app/i18n.js';
import { useApp } from '../app/context.js';
import { avatarColor, fullName, initials } from '../core/model.js';
import { currentSeason, seasonName, todayIso } from '../core/dates.js';

export function useImageUrl(id) {
  const { data } = useApp();
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (id) data.imageUrl(id).then(value => alive && setUrl(value));
    return () => { alive = false; };
  }, [id, data.imageUrl]);
  return url;
}

export function Avatar({ person, size = 32 }) {
  const url = useImageUrl(person?.photo);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (url) return <img className="avatar" src={url} alt="" style={style} />;
  return (
    <span className="avatar" style={{ ...style, background: avatarColor(person) }} aria-hidden="true">
      {initials(person)}
    </span>
  );
}

export function SecureImage({ id, alt = '', className }) {
  const url = useImageUrl(id);
  return url ? <img src={url} alt={alt} className={className} /> : <span className={`${className} img-placeholder`} />;
}

// Accessible dialog: Esc and backdrop close it, focus moves inside and back.
export function Modal({ title, onClose, children, footer, size = 'md', labelledBy }) {
  const ref = useRef(null);
  const fallbackId = useId();
  const titleId = labelledBy || fallbackId;
  const { t } = useI18n();

  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector('input, textarea, select, button');
    first?.focus({ preventScroll: true });
    const onKey = event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    node?.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      node?.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      previous?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section ref={ref} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" aria-label={t('action.close')} onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </section>
    </div>
  );
}

export function Toast({ toast, onClose }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, toast.undo ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      {toast.kind === 'success' && <span className="toast-check"><Icon name="check" size={16} strokeWidth={2.6} /></span>}
      <span>{toast.message}</span>
      {toast.undo && (
        <button type="button" onClick={() => { toast.undo(); onClose(); }}>{t('action.undo')}</button>
      )}
    </div>
  );
}

// A list of chips with a text field: type and press Enter or comma to add.
export function ChipInput({ id, values, onChange, placeholder, suggestions = [], prefix = '' }) {
  const [text, setText] = useState('');
  const listId = useId();
  const { t } = useI18n();

  const add = raw => {
    const value = raw.trim().replace(/^#/, '');
    if (value && !values.includes(value)) onChange([...values, value]);
    setText('');
  };

  return (
    <div className="chip-field">
      {values.map(value => (
        <span className="chip" key={value}>
          {prefix}{value}
          <button type="button" className="chip-x" aria-label={t('editor.removePerson', { name: value })} onClick={() => onChange(values.filter(v => v !== value))}>
            <Icon name="close" size={12} strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        id={id} value={text} list={listId} placeholder={placeholder}
        onChange={event => {
          const value = event.target.value;
          if (value.endsWith(',')) add(value.slice(0, -1));
          else setText(value);
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add(text);
          } else if (event.key === 'Backspace' && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => text.trim() && add(text)}
      />
      <datalist id={listId}>
        {suggestions.filter(s => !values.includes(s)).slice(0, 30).map(s => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}

const SEASONS = ['winter', 'spring', 'summer', 'autumn'];

export function WhenField({ value, onChange, legendId }) {
  const { t, lang } = useI18n();
  const mode = value?.kind || 'none';
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 1989 }, (_, i) => thisYear - i);

  const setMode = next => {
    if (next === 'none') onChange(null);
    if (next === 'exact') onChange({ kind: 'exact', date: todayIso() });
    if (next === 'approx') onChange({ kind: 'approx', year: thisYear, season: currentSeason() });
  };

  return (
    <fieldset className="field when-field">
      <legend id={legendId}>{t('when.label')}</legend>
      <div className="when-row">
        <div className="segmented" role="group" aria-labelledby={legendId}>
          {['exact', 'approx', 'none'].map(option => (
            <button key={option} type="button" aria-pressed={mode === option} onClick={() => setMode(option)}>
              {t(`when.${option}`)}
            </button>
          ))}
        </div>
        {mode === 'exact' && (
          <label className="inline-field">
            <span className="sr-only">{t('when.date')}</span>
            <input type="date" value={value.date} max="2100-12-31" onChange={e => e.target.value && onChange({ kind: 'exact', date: e.target.value })} />
          </label>
        )}
        {mode === 'approx' && (
          <>
            <label className="inline-field">
              <span className="sr-only">{t('when.season')}</span>
              <select value={value.season || ''} onChange={e => onChange({ ...value, season: e.target.value || null })}>
                <option value="">{t('when.anySeason')}</option>
                {SEASONS.map(season => (
                  <option key={season} value={season}>{seasonName(season, lang)}</option>
                ))}
              </select>
            </label>
            <label className="inline-field">
              <span className="sr-only">{t('when.year')}</span>
              <select value={value.year} onChange={e => onChange({ ...value, year: Number(e.target.value) })}>
                {years.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </>
        )}
      </div>
    </fieldset>
  );
}

export function PersonChip({ person, onClick }) {
  const name = fullName(person);
  const content = <><Avatar person={person} size={24} />{name}</>;
  if (!onClick) return <span className="person-chip">{content}</span>;
  return <button type="button" className="person-chip" onClick={onClick}>{content}</button>;
}

export function EmptyState({ title, text, action, picture }) {
  return (
    <div className="empty">
      {picture}
      {title && <h2>{title}</h2>}
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function downloadText(filename, text) {
  downloadBlob(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }));
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
