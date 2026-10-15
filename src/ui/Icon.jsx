// Stroke icons drawn inline, so the page needs no icon font or network.
const PATHS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  game: <><rect x="2.5" y="7" width="19" height="11" rx="5" /><path d="M7.5 10.5v4M5.5 12.5h4M15.5 11h.01M18 14h.01" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  dots: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  camera: <><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5-8.5 8.5" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  feed: <path d="M4 6h16M4 12h16M4 18h10" />,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2" /></>,
  data: <><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" /></>,
  trash: <path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14" />,
  sync: <><path d="M20 11a8 8 0 0 0-14.3-4.6L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 13a8 8 0 0 0 14.3 4.6l1.7-2.1" /><path d="M20 20v-4.5h-4.5" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />
};

export function Icon({ name, size = 18, filled = false, strokeWidth = 2 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className="icon"
    >
      {PATHS[name]}
    </svg>
  );
}
