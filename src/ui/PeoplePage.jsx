import { useMemo, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { Avatar, copyText, EmptyState } from './common.jsx';
import { StoryCard } from './StoryCard.jsx';
import { Party } from './Illustrations.jsx';
import { useI18n } from '../app/i18n.js';
import { useApp } from '../app/context.js';
import { fullName } from '../core/model.js';
import { formatSince, formatWhen } from '../core/dates.js';
import { filterPeople, firstMet, sortStories, storiesWith } from '../core/search.js';

const PAGE_SIZE = 10;

export function PeoplePage() {
  const { t } = useI18n();
  const { data, ui } = useApp();
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const map = new Map();
    for (const story of data.stories) for (const id of story.people) map.set(id, (map.get(id) || 0) + 1);
    return map;
  }, [data.stories]);

  const list = useMemo(() => {
    return filterPeople(data.people, query)
      .slice()
      .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || fullName(a).localeCompare(fullName(b)));
  }, [data.people, query, counts]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('people.title')}</h1>
        <button type="button" className="btn btn-primary" onClick={() => ui.openPerson()}>
          <Icon name="plus" size={16} strokeWidth={2.4} />{t('people.add')}
        </button>
      </div>

      {data.people.length > 0 && (
        <label className="search search-wide">
          <Icon name="search" size={16} />
          <span className="sr-only">{t('people.search')}</span>
          <input type="search" value={query} placeholder={t('people.search')} onChange={e => setQuery(e.target.value)} />
        </label>
      )}

      <div className="people-grid">
        {list.map((person, index) => (
          <a key={person.id} href={`#/people/${person.id}`} className="card person-card" style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}>
            <Avatar person={person} size={52} />
            <span className="person-card-body">
              <span className="person-name">{fullName(person)}</span>
              {person.status && <span className="status">{person.status}</span>}
              {person.games.length > 0 && <span className="muted small">{person.games.join(', ')}</span>}
              <span className="muted small">{t('people.stories', { count: counts.get(person.id) || 0 })}</span>
            </span>
          </a>
        ))}
      </div>

      {data.people.length === 0 && (
        <EmptyState
          picture={<Party />}
          title={t('people.emptyTitle')} text={`${t('people.emptyText')} ${t('people.emptyHint')}`}
          action={<button type="button" className="btn btn-primary" onClick={() => ui.openPerson()}>{t('people.add')}</button>}
        />
      )}
      {data.people.length > 0 && list.length === 0 && <EmptyState text={t('people.noResults')} />}
    </div>
  );
}

const isWebLink = value => /^https?:\/\/\S+$/i.test(value);

export function PersonPage({ id }) {
  const { t, lang } = useI18n();
  const { data, ui } = useApp();
  const [game, setGame] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [copied, setCopied] = useState('');
  const photoInput = useRef(null);
  const person = data.peopleById.get(id);

  const shared = useMemo(() => (person ? sortStories(storiesWith(person.id, data.stories), 'newest') : []), [person, data.stories]);
  if (!person) {
    return (
      <div className="page">
        <a href="#/people" className="back-link"><Icon name="back" size={16} />{t('person.back')}</a>
        <EmptyState text={t('person.notFound')} />
      </div>
    );
  }

  const games = [...new Set(shared.map(s => s.game).filter(Boolean))];
  const visible = game ? shared.filter(s => s.game === game) : shared;
  const since = firstMet(person, data.stories);
  const hasInfo = person.met.text || person.met.when || person.met.game || person.nicks.length || person.contacts.length || person.note;

  const onPhoto = async file => {
    if (!file) return;
    const photo = await data.addPhoto(file);
    await data.savePerson({ ...person, photo });
  };

  const copyNick = async nick => {
    if (await copyText(nick)) {
      setCopied(nick);
      setTimeout(() => setCopied(''), 1500);
    }
  };

  return (
    <div className="page">
      <a href="#/people" className="back-link"><Icon name="back" size={16} />{t('person.back')}</a>

      <section className="card person-hero">
        <div className="photo-wrap">
          <Avatar person={person} size={96} />
          <button type="button" className="photo-btn" aria-label={t('person.addPhoto')} onClick={() => photoInput.current?.click()}>
            <Icon name="camera" size={16} />
          </button>
          <input ref={photoInput} type="file" accept="image/*" hidden onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <div className="person-hero-body">
          <div className="title-row">
            <h1>{fullName(person)}</h1>
            {person.status && <span className="status">{person.status}</span>}
          </div>
          <p className="sub">
            {[since && t('person.since', { date: formatSince(since, lang) }), t('people.stories', { count: shared.length })].filter(Boolean).join(', ')}
          </p>
          {person.games.length > 0 && <div className="tag-cloud">{person.games.map(g => <span key={g} className="game-pill">{g}</span>)}</div>}
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={() => ui.openStory(null, person.id)}>{t('person.newStory')}</button>
          <button type="button" className="btn" onClick={() => ui.openPerson(person)}><Icon name="edit" size={16} />{t('action.edit')}</button>
        </div>
      </section>

      <div className="person-columns">
        <div className="person-info">
          {(person.met.text || person.met.when || person.met.game) && (
            <section className="card info-card">
              <h2>{t('person.met')}</h2>
              {(person.met.when || person.met.game) && (
                <p className="accent-text">{[person.met.when && formatWhen(person.met.when, lang), person.met.game].filter(Boolean).join(', ')}</p>
              )}
              {person.met.text && <p className="pre">{person.met.text}</p>}
            </section>
          )}
          {person.nicks.length > 0 && (
            <section className="card info-card">
              <h2>{t('person.nicks')}</h2>
              {person.nicks.map((row, index) => (
                <div key={index} className="kv">
                  <span className="muted">{row.game}</span>
                  <span className="kv-value">{row.nick}</span>
                  {row.nick && (
                    <button type="button" className="icon-btn" aria-label={copied === row.nick ? t('action.copied') : t('person.copyNick', { nick: row.nick })} onClick={() => copyNick(row.nick)}>
                      <Icon name={copied === row.nick ? 'check' : 'copy'} size={16} />
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}
          {person.contacts.length > 0 && (
            <section className="card info-card">
              <h2>{t('person.contacts')}</h2>
              {person.contacts.map((row, index) => (
                <div key={index} className="kv">
                  <span className="muted">{row.label}</span>
                  {isWebLink(row.value)
                    ? <a className="kv-value" href={row.value} target="_blank" rel="noopener noreferrer">{row.value.replace(/^https?:\/\//, '')}</a>
                    : <span className="kv-value">{row.value}</span>}
                </div>
              ))}
            </section>
          )}
          {person.note && (
            <section className="card info-card">
              <h2>{t('person.note')}</h2>
              <p className="pre">{person.note}</p>
            </section>
          )}
          {!hasInfo && <p className="card info-card muted">{t('person.emptyInfo')}</p>}
        </div>

        <section className="person-stories" aria-labelledby="shared-stories">
          <div className="section-head">
            <h2 id="shared-stories">{t('person.stories')}</h2>
            {games.length > 1 && (
              <div className="tag-cloud">
                <button type="button" className="tag-toggle" aria-pressed={!game} onClick={() => setGame('')}>{t('person.all', { count: shared.length })}</button>
                {games.map(g => (
                  <button key={g} type="button" className="tag-toggle" aria-pressed={game === g} onClick={() => setGame(game === g ? '' : g)}>{g}</button>
                ))}
              </div>
            )}
          </div>
          {visible.length === 0 && <p className="muted">{t('person.noStories')}</p>}
          <div className="story-list">
            {visible.slice(0, limit).map(story => <StoryCard key={story.id} story={story} />)}
          </div>
          {visible.length > limit && (
            <button type="button" className="btn" onClick={() => setLimit(limit + PAGE_SIZE)}>
              {t('person.showMore', { count: Math.min(PAGE_SIZE, visible.length - limit) })}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
