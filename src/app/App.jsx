import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppContext } from './context.js';
import { I18nContext, detectLanguage, makeT } from './i18n.js';
import { go, useRoute } from './router.js';
import { useVault } from './useVault.js';
import { useData } from './useData.js';
import { EMPTY_FILTERS } from '../core/search.js';
import { BottomNav, Header } from '../ui/Header.jsx';
import { FeedPage } from '../ui/FeedPage.jsx';
import { PeoplePage, PersonPage } from '../ui/PeoplePage.jsx';
import { DataPage } from '../ui/DataPage.jsx';
import { StoryEditor } from '../ui/StoryEditor.jsx';
import { PersonEditor } from '../ui/PersonEditor.jsx';
import { ImageViewer } from '../ui/ImageViewer.jsx';
import { Toast } from '../ui/common.jsx';
import { ErrorScreen, RecoveryScreen, UnlockScreen, WelcomeScreen } from '../ui/VaultScreens.jsx';

function readSetting(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not critical: the setting just will not be remembered.
  }
}

export function App() {
  const [lang, setLangState] = useState(detectLanguage);
  const [theme, setThemeState] = useState(() => readSetting('gamefolk.theme', 'dark'));
  const vault = useVault();
  const i18n = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);

  const setLang = useCallback(next => {
    setLangState(next);
    writeSetting('gamefolk.lang', next);
  }, []);
  const setTheme = useCallback(next => {
    setThemeState(next);
    writeSetting('gamefolk.theme', next);
  }, []);
  const toggleLang = () => setLang(lang === 'ru' ? 'en' : 'ru');

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#161B24' : '#F2F5F9');
  }, [theme]);

  let screen = null;
  if (vault.status === 'error') screen = <ErrorScreen onLang={toggleLang} />;
  if (vault.status === 'new') screen = <WelcomeScreen onStart={vault.create} onLang={toggleLang} />;
  if (vault.status === 'recovery') screen = <RecoveryScreen recoveryKey={vault.recoveryText} onDone={vault.confirmRecovery} onLang={toggleLang} />;
  if (vault.status === 'locked') screen = <UnlockScreen onPasscode={vault.unlockWithPasscode} onRecovery={vault.unlockWithRecovery} onLang={toggleLang} />;
  if (vault.status === 'open') {
    screen = <Journal key={vault.db ? 'open' : 'none'} vault={vault} theme={theme} setTheme={setTheme} setLang={setLang} />;
  }

  return <I18nContext.Provider value={i18n}>{screen}</I18nContext.Provider>;
}

// The open journal. Unmounts on lock, which drops decrypted data from memory.
function Journal({ vault, theme, setTheme, setLang }) {
  const data = useData(vault.db, vault.dataKey);
  const route = useRoute();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('newest');
  const [storyDialog, setStoryDialog] = useState(null);
  const [personDialog, setPersonDialog] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [toast, setToast] = useState(null);

  const ui = useMemo(() => ({
    openStory: (story = null, presetPerson = null) => setStoryDialog({ story, presetPerson }),
    openPerson: (person = null) => setPersonDialog({ person }),
    openViewer: (images, index) => setViewer({ images, index }),
    toast: (message, undo = null) => setToast({ id: Date.now(), message, undo }),
    filterBy: patch => {
      setFilters({ ...EMPTY_FILTERS, ...patch });
      if (route.page !== 'feed') go('/feed');
    }
  }), [route.page]);

  const closeToast = useCallback(() => setToast(null), []);
  const closeStory = useCallback(() => setStoryDialog(null), []);
  const closePerson = useCallback(() => setPersonDialog(null), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  const dialogOpen = Boolean(storyDialog || personDialog || viewer);

  // Keyboard shortcuts: N for a new story, / to search.
  useEffect(() => {
    const onKey = event => {
      if (dialogOpen || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (event.key === 'n' || event.key === 'т') {
        event.preventDefault();
        ui.openStory();
      } else if (event.key === '/') {
        const field = [...document.querySelectorAll('#global-search, #feed-search')].find(el => el.offsetParent);
        if (field) {
          event.preventDefault();
          field.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, ui]);

  const app = { data, vault, ui, theme, setTheme, setLang };
  const setQuery = query => setFilters(current => ({ ...current, query }));

  let page;
  if (!data.loaded) page = <div className="page" aria-busy="true" />;
  else if (route.page === 'people' && route.id) page = <PersonPage key={route.id} id={route.id} />;
  else if (route.page === 'people') page = <PeoplePage />;
  else if (route.page === 'data') page = <DataPage />;
  else page = <FeedPage starredOnly={route.page === 'starred'} filters={filters} setFilters={setFilters} sort={sort} setSort={setSort} />;

  return (
    <AppContext.Provider value={app}>
      <Header route={route} query={filters.query} onQuery={setQuery} />
      <div className="app-body">{page}</div>
      <BottomNav route={route} />
      {storyDialog && <StoryEditor story={storyDialog.story} presetPerson={storyDialog.presetPerson} onClose={closeStory} />}
      {personDialog && <PersonEditor person={personDialog.person} onClose={closePerson} />}
      {viewer && <ImageViewer images={viewer.images} start={viewer.index} onClose={closeViewer} />}
      <Toast toast={toast} onClose={closeToast} />
    </AppContext.Provider>
  );
}
