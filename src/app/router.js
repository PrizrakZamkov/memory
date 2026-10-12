// Hash routes, so the site works when opened as a local file:
// #/feed, #/starred, #/people, #/people/<id>, #/data
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

const PAGES = ['feed', 'starred', 'people', 'data'];

export function parseHash(hash) {
  const [page, id] = String(hash || '').replace(/^#\/?/, '').split('/');
  const known = PAGES.includes(page) ? page : 'feed';
  return { page: known, id: known === 'people' && id ? decodeURIComponent(id) : null };
}

export function go(path) {
  window.location.hash = path;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      const next = parseHash(window.location.hash);
      const apply = () => {
        flushSync(() => setRoute(next));
        window.scrollTo(0, 0);
      };
      if (document.startViewTransition && !reducedMotion()) document.startViewTransition(apply);
      else apply();
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
