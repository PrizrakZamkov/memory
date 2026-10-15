import { useMemo, useState } from 'react';
import { Icon } from './Icon.jsx';
import { Avatar, EmptyState, Modal } from './common.jsx';
import { StoryCard } from './StoryCard.jsx';
import { Campfire, Lens, StarSky } from './Illustrations.jsx';
import { useBackupDownload } from './BackupSection.jsx';
import { smoothly, useCountUp } from './motion.js';
import { greetingKey, useI18n } from '../app/i18n.js';
import { useApp } from '../app/context.js';
import { fullName } from '../core/model.js';
import { EMPTY_FILTERS, facets, filterStories, onThisDay, sortStories } from '../core/search.js';

const PEOPLE_IN_PANEL = 10;

export function FeedPage({ starredOnly, filters, setFilters: applyFilters, sort, setSort: applySort }) {
  const { t, lang } = useI18n();
  const { data, ui } = useApp();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Filter and sort changes rearrange the cards smoothly; typing in search stays instant.
  const setFilters = next => (next.query === filters.query ? smoothly(() => applyFilters(next)) : applyFilters(next));
  const setSort = next => smoothly(() => applySort(next));

  const base = useMemo(() => (starredOnly ? data.stories.filter(s => s.starred) : data.stories), [data.stories, starredOnly]);
  const counts = useMemo(() => facets(base), [base]);
  const list = useMemo(() => sortStories(filterStories(base, filters, data.peopleById), sort), [base, filters, sort, data.peopleById]);
  const untouched = !filters.query && !filters.game && !filters.person && !filters.tag && !filters.year;
  const memory = useMemo(() => (!starredOnly && untouched ? onThisDay(data.stories) : null), [data.stories, starredOnly, untouched]);

  const active = [
    filters.game && { key: 'game', label: filters.game },
    filters.person && { key: 'person', label: fullName(data.peopleById.get(filters.person)) || '?' },
    filters.tag && { key: 'tag', label: `#${filters.tag}` },
    filters.year && { key: 'year', label: String(filters.year) }
  ].filter(Boolean);

  const stats = t('feed.stats', {
    stories: useCountUp(data.stories.length),
    people: useCountUp(data.people.length),
    games: useCountUp(new Set(data.stories.map(s => s.game).filter(Boolean)).size),
    starred: useCountUp(data.stories.filter(s => s.starred).length)
  });

  const panel = <FilterPanel counts={counts} filters={filters} setFilters={setFilters} />;

  return (
    <div className="feed-layout">
      <aside className="filters desktop-only" aria-label={t('filters.title')}>{panel}</aside>

      <section className="feed-main">
        <div className="page-head">
          <div>
            {!starredOnly && <p className="greeting">{t(greetingKey(), { name: data.profile.name })}</p>}
            <h1>{starredOnly ? t('starred.title') : t('feed.title')}</h1>
            {data.stories.length > 0 && <p className="sub">{stats}</p>}
          </div>
          <label className="sort">
            <span>{t('sort.label')}</span>
            <select value={sort} onChange={event => setSort(event.target.value)}>
              <option value="newest">{t('sort.newest')}</option>
              <option value="oldest">{t('sort.oldest')}</option>
              <option value="starred">{t('sort.starred')}</option>
            </select>
          </label>
        </div>

        <div className="mobile-tools mobile-only">
          <label className="search">
            <Icon name="search" size={16} />
            <span className="sr-only">{t('header.search')}</span>
            <input
              id="feed-search" type="search" value={filters.query} placeholder={t('header.search')}
              onChange={event => setFilters({ ...filters, query: event.target.value })}
            />
          </label>
          <button type="button" className="btn" onClick={() => setSheetOpen(true)}>
            <Icon name="filter" size={16} />{t('filters.open', { count: active.length })}
          </button>
        </div>

        {active.length > 0 && (
          <div className="active-filters">
            <span className="muted">{t('filters.shown')}</span>
            {active.map(item => (
              <span key={item.key} className="active-chip">
                {item.label}
                <button type="button" aria-label={t('filters.remove', { name: item.label })} onClick={() => setFilters({ ...filters, [item.key]: '' })}>
                  <Icon name="close" size={12} strokeWidth={2.5} />
                </button>
              </span>
            ))}
            <button type="button" className="link-btn" onClick={() => setFilters({ ...EMPTY_FILTERS, query: filters.query })}>{t('action.reset')}</button>
          </div>
        )}

        {!starredOnly && <BackupReminder />}

        {memory && (
          <section className="memory" aria-label={t(`onThisDay.${memory.kind}`, { years: memory.years })}>
            <p className="memory-label"><Icon name="star" size={16} filled />{t(`onThisDay.${memory.kind}`, { years: memory.years })}</p>
            <StoryCard story={memory.story} transitionName={false} />
          </section>
        )}

        {list.length > 0 && (
          <div className="story-list">
            {list.map((story, index) => <StoryCard key={story.id} story={story} index={index} />)}
          </div>
        )}

        {data.stories.length === 0 && (
          <EmptyState
            picture={<Campfire />}
            title={t('feed.emptyTitle')}
            text={t('feed.emptyText')}
            action={(
              <div className="row-actions">
                <button type="button" className="btn btn-primary" onClick={() => ui.openStory()}>{t('action.newStory')}</button>
                <button type="button" className="btn" onClick={() => data.addSample(lang)}>{t('feed.sample')}</button>
              </div>
            )}
          />
        )}
        {data.stories.length > 0 && list.length === 0 && (starredOnly && base.length === 0
          ? <EmptyState picture={<StarSky />} text={t('starred.empty')} />
          : <EmptyState picture={<Lens />} text={t('feed.noResults')} />)}
      </section>

      {sheetOpen && (
        <Modal
          title={t('filters.title')} size="sheet" onClose={() => setSheetOpen(false)}
          footer={<button type="button" className="btn btn-primary btn-wide" onClick={() => setSheetOpen(false)}>{t('filters.show', { count: list.length })}</button>}
        >
          {panel}
        </Modal>
      )}
    </div>
  );
}

const SNOOZE_KEY = 'gamefolk.backupSnooze';
const REMIND_AFTER_DAYS = 7;

function BackupReminder() {
  const { t } = useI18n();
  const { data, vault, sync } = useApp();
  const download = useBackupDownload();
  const [snoozed, setSnoozed] = useState(() => {
    try {
      return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now();
    } catch {
      return false;
    }
  });
  const last = vault.settings?.lastBackupAt;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : 0;
  if (snoozed || sync.account || data.stories.length === 0 || (last && days < REMIND_AFTER_DAYS)) return null;

  const later = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 3 * 86400000));
    } catch {
      // Not critical.
    }
    setSnoozed(true);
  };

  return (
    <div className="reminder" role="status">
      <Icon name="download" size={20} />
      <div className="grow">
        <p className="reminder-title">{t('backup.reminder', { days })}</p>
        <p className="muted small">{t('backup.reminderText')}</p>
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-primary" onClick={download}>{t('backup.download')}</button>
        <button type="button" className="btn" onClick={later}>{t('backup.later')}</button>
      </div>
    </div>
  );
}

function FilterPanel({ counts, filters, setFilters }) {
  const { t } = useI18n();
  const { data } = useApp();
  const toggle = (key, value) => setFilters({ ...filters, [key]: filters[key] === value ? '' : value });
  const people = counts.people.map(c => ({ person: data.peopleById.get(c.value), count: c.count })).filter(p => p.person).slice(0, PEOPLE_IN_PANEL);

  return (
    <div className="filter-panel">
      {counts.games.length > 0 && (
        <section>
          <h2>{t('filters.games')}</h2>
          <button type="button" className="filter-row" aria-pressed={!filters.game} onClick={() => setFilters({ ...filters, game: '' })}>
            <span>{t('filters.allGames')}</span>
          </button>
          {counts.games.map(game => (
            <button key={game.value} type="button" className="filter-row" aria-pressed={filters.game === game.value} onClick={() => toggle('game', game.value)}>
              <span>{game.value}</span><span className="count">{game.count}</span>
            </button>
          ))}
        </section>
      )}

      {people.length > 0 && (
        <section>
          <h2>{t('filters.people')}</h2>
          {people.map(({ person, count }) => (
            <button key={person.id} type="button" className="filter-row" aria-pressed={filters.person === person.id} onClick={() => toggle('person', person.id)}>
              <Avatar person={person} size={24} />
              <span className="grow">{fullName(person)}</span>
              <span className="count">{count}</span>
            </button>
          ))}
        </section>
      )}

      {counts.tags.length > 0 && (
        <section>
          <h2>{t('filters.tags')}</h2>
          <div className="tag-cloud">
            {counts.tags.map(tag => (
              <button key={tag.value} type="button" className="tag-toggle" aria-pressed={filters.tag === tag.value} onClick={() => toggle('tag', tag.value)}>
                #{tag.value}
              </button>
            ))}
          </div>
        </section>
      )}

      {counts.years.length > 0 && (
        <section>
          <label className="field-label" htmlFor="filter-year">{t('filters.year')}</label>
          <select id="filter-year" value={filters.year} onChange={event => setFilters({ ...filters, year: event.target.value })}>
            <option value="">{t('filters.anyYear')}</option>
            {counts.years.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </section>
      )}
    </div>
  );
}
