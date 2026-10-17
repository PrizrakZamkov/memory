import { Icon } from './Icon.jsx';
import { useI18n } from '../app/i18n.js';
import { useApp } from '../app/context.js';
import { go } from '../app/router.js';
import { LangSelect } from './common.jsx';

const NAV = [
  { page: 'feed', icon: 'feed' },
  { page: 'starred', icon: 'star' },
  { page: 'people', icon: 'people' },
  { page: 'data', icon: 'data' }
];

export function Header({ route, query, onQuery }) {
  const { t, lang } = useI18n();
  const { vault, ui, theme, setTheme, setLang } = useApp();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a href="#/feed" className="logo">Gamefolk</a>
        <nav className="topnav desktop-only" aria-label={t('nav.main')}>
          {NAV.map(item => (
            <a key={item.page} href={`#/${item.page}`} aria-current={route.page === item.page ? 'page' : undefined}>
              {t(`nav.${item.page}`)}
            </a>
          ))}
        </nav>
        <span className="grow" />
        <label className="search desktop-only">
          <Icon name="search" size={16} />
          <span className="sr-only">{t('header.search')}</span>
          <input
            id="global-search" type="search" value={query} placeholder={t('header.searchPlaceholder')}
            onChange={event => {
              onQuery(event.target.value);
              if (route.page !== 'feed' && route.page !== 'starred') go('/feed');
            }}
          />
        </label>
        <button type="button" className="btn desktop-only" onClick={() => ui.openPerson()}>
          <Icon name="plus" size={16} />{t('action.person')}
        </button>
        <button type="button" className="btn btn-primary desktop-only" onClick={() => ui.openStory()}>
          <Icon name="plus" size={16} strokeWidth={2.4} />{t('action.story')}
        </button>
        <LangSelect lang={lang} onChange={setLang} />
        <button type="button" className="icon-btn" aria-label={t('header.theme')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} />
        </button>
        {vault.settings?.hasPasscode && (
          <button type="button" className="icon-btn" aria-label={t('header.lock')} onClick={vault.lock}>
            <Icon name="lock" />
          </button>
        )}
      </div>
    </header>
  );
}

// Phone navigation: always reachable with a thumb.
export function BottomNav({ route }) {
  const { t } = useI18n();
  const { ui } = useApp();
  const link = item => (
    <a key={item.page} href={`#/${item.page}`} aria-current={route.page === item.page ? 'page' : undefined}>
      <Icon name={item.icon} size={22} />
      <span>{t(`nav.${item.page}`)}</span>
    </a>
  );
  return (
    <nav className="bottomnav mobile-only" aria-label={t('nav.main')}>
      {NAV.slice(0, 2).map(link)}
      <button type="button" className="fab" aria-label={t('action.newStory')} onClick={() => ui.openStory()}>
        <Icon name="plus" size={26} strokeWidth={2.4} />
      </button>
      {NAV.slice(2).map(link)}
    </nav>
  );
}
