import { useState } from 'react';
import { Icon } from './Icon.jsx';
import { PersonChip, SecureImage } from './common.jsx';
import { useI18n } from '../app/i18n.js';
import { useApp } from '../app/context.js';
import { go } from '../app/router.js';
import { formatWhen } from '../core/dates.js';

const isLong = text => text.length > 280 || text.split('\n').length > 4;

export function StoryCard({ story }) {
  const { t, lang } = useI18n();
  const { data, ui } = useApp();
  const [open, setOpen] = useState(false);
  const people = story.people.map(id => data.peopleById.get(id)).filter(Boolean);

  return (
    <article className="card story">
      <div className="story-top">
        <div className="who">
          {people.map(person => (
            <PersonChip key={person.id} person={person} onClick={() => go(`/people/${person.id}`)} />
          ))}
          {story.names.map(name => <span key={name} className="name-chip">{name}</span>)}
          {story.randomPlayers > 0 && <span className="name-chip">{t('story.random', { count: story.randomPlayers })}</span>}
        </div>
        <span className="story-date">{story.when ? formatWhen(story.when, lang) : t('story.noDate')}</span>
        <button
          type="button" className="star-btn" aria-pressed={story.starred}
          aria-label={story.starred ? t('story.unstar') : t('story.star')}
          onClick={() => data.toggleStar(story)}
        >
          <Icon name="star" size={20} filled={story.starred} strokeWidth={1.8} />
        </button>
      </div>

      <h3>{story.title}</h3>

      {story.game && (
        <button type="button" className="game-link" onClick={() => ui.filterBy({ game: story.game })}>
          <Icon name="game" size={16} />{story.game}
        </button>
      )}

      {story.text && <p className={open ? 'story-text' : 'story-text clamped'}>{story.text}</p>}
      {story.text && isLong(story.text) && (
        <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t('action.readLess') : t('action.readMore')}
        </button>
      )}

      {story.images.length > 0 && <StoryImages story={story} onOpen={index => ui.openViewer(story.images, index)} />}

      <footer className="story-foot">
        {story.tags.map(tag => (
          <button key={tag} type="button" className="tag" onClick={() => ui.filterBy({ tag })}>#{tag}</button>
        ))}
        <span className="grow" />
        <button type="button" className="icon-btn" aria-label={t('story.edit')} onClick={() => ui.openStory(story)}>
          <Icon name="edit" size={17} />
        </button>
      </footer>
    </article>
  );
}

function StoryImages({ story, onOpen }) {
  const { t } = useI18n();
  const shown = story.images.slice(0, 3);
  const extra = story.images.length - shown.length;
  return (
    <div className={`story-images count-${shown.length}`}>
      {shown.map((image, index) => (
        <button key={image.id} type="button" className="thumb" onClick={() => onOpen(index)} aria-label={t('story.openImage', { index: index + 1 })}>
          <SecureImage id={`${image.id}.thumb`} className="thumb-img" />
          {index === shown.length - 1 && extra > 0 && <span className="thumb-more">{t('story.moreImages', { count: extra })}</span>}
        </button>
      ))}
    </div>
  );
}
