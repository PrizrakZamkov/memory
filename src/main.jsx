import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const ACCENTS = [
  'linear-gradient(90deg,#d4a853,#f0c97a)',
  'linear-gradient(90deg,#8b7fff,#b8b0ff)',
  'linear-gradient(90deg,#ff6b7a,#f0c97a)',
  'linear-gradient(90deg,#4ecdc4,#8b7fff)',
  'linear-gradient(90deg,#55efc4,#4ecdc4)',
  'linear-gradient(90deg,#fd79a8,#b8b0ff)'
];
const AV_COLORS = ['#8b7fff','#d4a853','#ff6b7a','#4ecdc4','#f0c97a','#a29bfe','#fd79a8','#55efc4','#74b9ff','#e17055'];
const GAME_SUGGESTIONS = ['The Witcher 3','Baldur\'s Gate 3','Elden Ring','Cyberpunk 2077','Dark Souls','Mass Effect','Dragon Age','Hades','Disco Elysium','Stardew Valley','Minecraft'];
const TAG_SUGGESTIONS = ['funny','emotional','epic','fail','coop','solo','betrayal','chaos','midnight','meme','tearjerker','boss','roleplay','immersive','ending','pvp','lore','wholesome'];

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function initials(name) {
  return name.trim().split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

function avatarColor(str) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return AV_COLORS[h % AV_COLORS.length];
}

function profileName(p) {
  return `${p.fname}${p.lname ? ` ${p.lname}` : ''}`;
}

function fmtDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function tabFromHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [tab, id] = hash.split('/');
  return { tab: ['feed', 'starred', 'people', 'data'].includes(tab) ? tab : 'feed', id: id || null };
}

function Landing({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [resetLink, setResetLink] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setResetLink('');
    try {
      if (mode === 'forgot') {
        const result = await api('/api/auth/forgot-password', { method: 'POST', body: { email: form.email } });
        setResetLink(result.devResetLink || 'If that email exists, a reset link has been sent.');
        return;
      }
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const { user } = await api(endpoint, { method: 'POST', body: form });
      onAuth(user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="landing">
      <section className="hero">
        <div className="brand"><span />storyline</div>
        <h1>Private memory feed for the stories you live with friends.</h1>
        <p>Р—Р°РїРёСЃС‹РІР°Р№ РёСЃС‚РѕСЂРёРё, РґСЂСѓР·РµР№, РёРіСЂС‹, С‚РµРіРё Рё СЃР°РјС‹Рµ СЃС‚СЂР°РЅРЅС‹Рµ РІРµС‡РµСЂР° РІ Р»РёС‡РЅС‹Р№ РїСЂРёРІР°С‚РЅС‹Р№ Р°СЂС…РёРІ.</p>
        <div className="hero-strip">
          <b>Private by default</b>
          <b>Encrypted story fields</b>
          <b>Email or Google login</b>
        </div>
      </section>
      <section className="auth-card">
        <div className="tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
        </div>
        <form onSubmit={submit}>
          {mode === 'register' && <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />}
          <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          {mode !== 'forgot' && <input placeholder="Password, 10+ chars" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />}
          {error && <div className="error">{error}</div>}
          {resetLink && <div className="notice">{resetLink}</div>}
          <button className="primary" type="submit">{mode === 'forgot' ? 'Send reset link' : mode === 'register' ? 'Create account' : 'Login'}</button>
        </form>
        <a className="google" href="/api/auth/google">Continue with Google</a>
        <button className="link" onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')}>{mode === 'forgot' ? 'Back to login' : 'Forgot password?'}</button>
      </section>
    </main>
  );
}

function Header({ user, tab, setTab, theme, setTheme, logout, openStory, openPerson }) {
  return (
    <header>
      <div className="header-shell">
        <button className="logo" onClick={() => setTab('feed')}><span />storyline</button>
        <nav className="nav">
          {[
            ['feed', 'Feed'],
            ['starred', 'Starred'],
            ['people', 'People'],
            ['data', 'Data']
          ].map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
        </nav>
        <div className="header-right">
          <button onClick={openPerson}>+ Person</button>
          <button className="primary" onClick={openStory}>+ Story</button>
          <button className="icon-btn theme-btn" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><span /></button>
          <button onClick={logout} title={user.email}>Logout</button>
        </div>
      </div>
    </header>
  );
}

function StoryModal({ profiles, story, gameSuggestions, tagSuggestions, onSave, onDelete, onClose, onCreatePerson }) {
  const [form, setForm] = useState(() => story || {
    title: '',
    story: '',
    game: '',
    tags: [],
    people: [],
    peopleRaw: [],
    randomPlayerCount: 0,
    starred: false,
    date: new Date().toISOString().slice(0, 10),
    accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)]
  });
  const [personText, setPersonText] = useState('');
  const [tagsText, setTagsText] = useState((form.tags || []).join(', '));
  const matches = personText.trim()
    ? profiles.filter(p => profileName(p).toLowerCase().includes(personText.trim().toLowerCase()) && !(form.people || []).includes(p.id)).slice(0, 6)
    : [];

  function submit(e) {
    e.preventDefault();
    onSave({
      ...form,
      tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
      peopleRaw: form.peopleRaw || [],
      randomPlayerCount: Number(form.randomPlayerCount || 0)
    });
  }

  async function createProfileFromInput() {
    const name = personText.trim();
    if (!name) return;
    const [fname, ...rest] = name.split(/\s+/);
    const person = await onCreatePerson({ fname, lname: rest.join(' '), games: form.game || '', desc: '', met: '' });
    setForm({ ...form, people: unique([...(form.people || []), person.id]) });
    setPersonText('');
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target.className === 'modal-backdrop' && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>{story?.id ? 'Edit Story' : 'New Story'}</h2>
        <label>People in this story</label>
        <div className="selected-row">
          {(form.people || []).map(id => {
            const p = profiles.find(x => x.id === id);
            if (!p) return null;
            return <button type="button" className="person-chip" key={id} onClick={() => setForm({ ...form, people: form.people.filter(x => x !== id) })}><i style={{ background: avatarColor(profileName(p)) }}>{initials(profileName(p))}</i>{profileName(p)} Г—</button>;
          })}
        </div>
        <input list="people-list" placeholder="Type a profile name..." value={personText} onChange={e => setPersonText(e.target.value)} onKeyDown={e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const p = profiles.find(x => profileName(x).toLowerCase() === personText.trim().toLowerCase());
          if (p && !form.people.includes(p.id)) setForm({ ...form, people: [...form.people, p.id] });
          setPersonText('');
        }} />
        {!!matches.length && <div className="ac-panel">
          {matches.map(p => <button type="button" key={p.id} onClick={() => { setForm({ ...form, people: unique([...(form.people || []), p.id]) }); setPersonText(''); }}><i style={{ background: avatarColor(profileName(p)) }}>{initials(profileName(p))}</i>{profileName(p)}</button>)}
        </div>}
        {personText.trim() && <div className="inline-actions">
          <button type="button" onClick={() => { setForm({ ...form, peopleRaw: unique([...(form.peopleRaw || []), personText.trim()]) }); setPersonText(''); }}>Add "{personText.trim()}" as name</button>
          <button type="button" onClick={createProfileFromInput}>Create profile for "{personText.trim()}"</button>
        </div>}
        <datalist id="people-list">{profiles.map(p => <option key={p.id} value={profileName(p)} />)}</datalist>
        {!!(form.peopleRaw || []).length && <div className="selected-row">
          {form.peopleRaw.map(name => <button type="button" className="person-chip raw-chip" key={name} onClick={() => setForm({ ...form, peopleRaw: form.peopleRaw.filter(x => x !== name) })}>{name} Г—</button>)}
        </div>}
        <div className="counter-row">
          <span>Random / unknown players</span>
          <button type="button" onClick={() => setForm({ ...form, randomPlayerCount: Math.max(0, Number(form.randomPlayerCount || 0) - 1) })}>-</button>
          <b>{form.randomPlayerCount || 0}</b>
          <button type="button" onClick={() => setForm({ ...form, randomPlayerCount: Number(form.randomPlayerCount || 0) + 1 })}>+</button>
        </div>
        <input placeholder="Story Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
        <textarea placeholder="What happened..." value={form.story} onChange={e => setForm({ ...form, story: e.target.value })} required />
        <div className="form-grid">
          <input list="games-list" placeholder="Game" value={form.game || ''} onChange={e => setForm({ ...form, game: e.target.value })} />
          <input list="tags-list" placeholder="funny, epic, fail..." value={tagsText} onChange={e => setTagsText(e.target.value)} />
        </div>
        <datalist id="games-list">{gameSuggestions.map(g => <option key={g} value={g} />)}</datalist>
        <datalist id="tags-list">{tagSuggestions.map(t => <option key={t} value={t} />)}</datalist>
        <div className="form-grid">
          <input type="date" value={form.date || new Date().toISOString().slice(0, 10)} onChange={e => setForm({ ...form, date: e.target.value })} />
          <label className="check"><input type="checkbox" checked={!!form.starred} onChange={e => setForm({ ...form, starred: e.target.checked })} /> Starred</label>
        </div>
        <div className="actions">
          {story?.id && <button type="button" className="danger" onClick={() => onDelete(story.id)}>Delete story</button>}
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary">Save</button>
        </div>
      </form>
    </div>
  );
}

function PersonModal({ person, gameSuggestions, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(() => person || { fname: '', lname: '', games: '', desc: '', met: '' });
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target.className === 'modal-backdrop' && onClose()}>
      <form className="modal" onSubmit={e => { e.preventDefault(); onSave(form); }}>
        <h2>{person?.id ? 'Edit Person' : 'New Person'}</h2>
        <div className="form-grid">
          <input placeholder="First Name *" value={form.fname} onChange={e => setForm({ ...form, fname: e.target.value })} required />
          <input placeholder="Last Name" value={form.lname || ''} onChange={e => setForm({ ...form, lname: e.target.value })} />
        </div>
        <input list="games-list" placeholder="Games you play together" value={form.games || ''} onChange={e => setForm({ ...form, games: e.target.value })} />
        <datalist id="games-list">{gameSuggestions.map(g => <option key={g} value={g} />)}</datalist>
        <textarea placeholder="Description" value={form.desc || ''} onChange={e => setForm({ ...form, desc: e.target.value })} />
        <textarea placeholder="How you met" value={form.met || ''} onChange={e => setForm({ ...form, met: e.target.value })} />
        <div className="actions">
          {person?.id && <button type="button" className="danger" onClick={() => onDelete(person.id)}>Delete</button>}
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary">Save Person</button>
        </div>
      </form>
    </div>
  );
}

function StoryCard({ story, profiles, onEdit, onToggleStar, onTag, onGame, onProfile }) {
  const [open, setOpen] = useState(false);
  const people = [
    ...(story.people || []).map(id => profiles.find(p => p.id === id)).filter(Boolean).map(p => ({ id: p.id, name: profileName(p), profile: true })),
    ...(story.peopleRaw || []).map(name => ({ id: name, name })),
    ...Array.from({ length: story.randomPlayerCount || 0 }, (_, i) => ({ id: `rand${i}`, name: story.randomPlayerCount === 1 ? 'Random Player' : `Random Player ${i + 1}` }))
  ];
  return (
    <article className="card">
      <div className="accent" style={{ background: story.accent || ACCENTS[0] }} />
      <div className="card-body">
        {!!people.length && <div className="people-row"><b>with</b>{people.map(p => <button className="person-chip" key={p.id} onClick={() => p.profile && onProfile(p.id)}><i style={{ background: avatarColor(p.name) }}>{initials(p.name)}</i>{p.name}</button>)}</div>}
        <div className="card-meta">
          <h3>{story.title}</h3>
          <div className="card-right"><span>{fmtDate(story.date)}</span><button className={story.starred ? 'star active' : 'star'} aria-label="Star story" onClick={() => onToggleStar(story)} /></div>
        </div>
        <button className="game" onClick={() => onGame(story.game)}><span className="game-icon" />{story.game || 'Unknown Game'}</button>
        <p className={open ? '' : 'clamped'} onClick={() => setOpen(!open)}>{story.story}</p>
        <div className="card-footer">
          <div className="tag-row">{(story.tags || []).map(t => <button className="tag" key={t} onClick={() => onTag(t)}>#{t}</button>)}</div>
          <div className="mini-actions">
            <button onClick={() => onEdit(story)}>Edit</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PeopleView({ profiles, stories, selectedId, setSelectedId, onAdd, onEdit, onDelete, storyActions }) {
  const selected = profiles.find(p => p.id === selectedId);
  if (selected) {
    const related = stories.filter(s => (s.people || []).includes(selected.id));
    return (
      <section>
        <button className="back-btn" onClick={() => setSelectedId(null)}>в†ђ Back to People</button>
        <div className="pd-header">
          <div className="avatar big" style={{ background: avatarColor(profileName(selected)) }}>{initials(profileName(selected))}</div>
          <div>
            <h2>{profileName(selected)}</h2>
            <b>{selected.games || 'No games listed'}</b>
            {selected.desc && <p>{selected.desc}</p>}
            {selected.met && <div className="met"><b>Met:</b>{selected.met}</div>}
            <div className="mini-actions"><button onClick={() => onEdit(selected)}>Edit</button><button onClick={() => onDelete(selected.id)}>Delete</button></div>
          </div>
        </div>
        <h2>Stories together ({related.length})</h2>
        <div className="feed">{related.length ? related.map(s => <StoryCard key={s.id} story={s} profiles={profiles} {...storyActions} onProfile={setSelectedId} />) : <div className="empty">No stories yet with this person</div>}</div>
      </section>
    );
  }
  return (
    <div className="profiles-grid">
      {profiles.map(p => {
        const count = stories.filter(s => (s.people || []).includes(p.id)).length;
        return <article className="profile-card" key={p.id} onClick={() => setSelectedId(p.id)}>
          <div className="avatar" style={{ background: avatarColor(profileName(p)) }}>{initials(profileName(p))}</div>
          <h3>{profileName(p)}</h3>
          <b>{p.games || 'No games listed'}</b>
          <p>{p.desc || 'No description'}</p>
          <small>{count} stor{count === 1 ? 'y' : 'ies'} together</small>
        </article>;
      })}
    </div>
  );
}

function DataView({ people, stories, onImport }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('replace');
  const [message, setMessage] = useState('');
  const data = useMemo(() => JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), people, stories }, null, 2), [people, stories]);

  function download() {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyline-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(file) {
    if (!file) return;
    setText(await file.text());
  }

  async function importNow() {
    const parsed = JSON.parse(text);
    await onImport({ ...parsed, mode });
    setMessage('Imported successfully.');
  }

  return (
    <section className="data-page">
      <div className="data-card">
        <div className="card-title-row">
          <div><h2>Export JSON</h2><p>Save all people and stories from this private account as readable JSON.</p></div>
          <div className="actions"><button onClick={() => navigator.clipboard?.writeText(data)}>Copy JSON</button><button className="primary" onClick={download}>Download JSON</button></div>
        </div>
        <textarea readOnly value={data} />
      </div>
      <div className="data-card">
        <h2>Import JSON</h2>
        <p>Load a previous export. Replace clears current data first; append keeps existing data.</p>
        <div className="form-grid import-controls"><select value={mode} onChange={e => setMode(e.target.value)}><option value="replace">Replace current data</option><option value="append">Append to current data</option></select><input type="file" accept="application/json,.json" onChange={e => upload(e.target.files?.[0])} /></div>
        <textarea placeholder="Paste JSON here..." value={text} onChange={e => setText(e.target.value)} />
        {message && <div className="notice">{message}</div>}
        <div className="actions"><button className="primary" onClick={importNow} disabled={!text.trim()}>Import JSON</button></div>
      </div>
    </section>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialRoute = tabFromHash();
  const [tab, setTabState] = useState(initialRoute.tab);
  const [stories, setStories] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [storyModal, setStoryModal] = useState(null);
  const [personModal, setPersonModal] = useState(null);
  const [selectedProfile, setSelectedProfileState] = useState(initialRoute.tab === 'people' ? initialRoute.id : null);
  const [gameFilter, setGameFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState(null);
  const [sort, setSort] = useState('newest');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [error, setError] = useState('');

  useEffect(() => { document.body.classList.toggle('dark', theme === 'dark'); localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { api('/api/auth/me').then(({ user }) => setUser(user)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (user) refresh(); }, [user]);
  useEffect(() => {
    const onPop = () => {
      const route = tabFromHash();
      setTabState(route.tab);
      setSelectedProfileState(route.tab === 'people' ? route.id : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(nextTab, profileId = null, push = true) {
    setTabState(nextTab);
    setSelectedProfileState(nextTab === 'people' ? profileId : null);
    const hash = profileId ? `#/${nextTab}/${profileId}` : `#/${nextTab}`;
    if (push && location.hash !== hash) history.pushState({}, '', hash);
  }

  function setSelectedProfile(id) {
    setSelectedProfileState(id);
    const hash = id ? `#/people/${id}` : '#/people';
    if (location.hash !== hash) history.pushState({}, '', hash);
  }

  async function refresh() {
    const [p, s] = await Promise.all([api('/api/people'), api('/api/stories')]);
    setProfiles(p.people);
    setStories(s.stories);
  }

  async function act(fn) {
    try {
      setError('');
      await fn();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }

  async function createPersonFromStory(person) {
    const { person: saved } = await api('/api/people', { method: 'POST', body: person });
    await refresh();
    return saved;
  }

  const games = unique(stories.map(s => s.game));
  const tags = unique(stories.flatMap(s => s.tags || []));
  const gameSuggestions = unique([...games, ...profiles.flatMap(p => String(p.games || '').split(',').map(g => g.trim())), ...GAME_SUGGESTIONS]);
  const tagSuggestions = unique([...tags, ...TAG_SUGGESTIONS]);
  const visibleStories = useMemo(() => {
    let list = tab === 'starred' ? stories.filter(s => s.starred) : [...stories];
    if (gameFilter !== 'all') list = list.filter(s => s.game === gameFilter);
    if (tagFilter) list = list.filter(s => (s.tags || []).includes(tagFilter));
    if (sort === 'newest') list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (sort === 'oldest') list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (sort === 'starred') list.sort((a, b) => Number(b.starred) - Number(a.starred));
    return list;
  }, [stories, tab, gameFilter, tagFilter, sort]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Landing onAuth={setUser} />;

  return (
    <>
      <Header user={user} tab={tab} setTab={navigate} theme={theme} setTheme={setTheme} logout={logout} openStory={() => setStoryModal({})} openPerson={() => setPersonModal({})} />
      <main className="page">
        {error && <div className="error banner">{error}</div>}
        <div className="section-head">
          <div><h1>{tab === 'people' ? 'Your People' : tab === 'data' ? 'Data Vault' : tab === 'starred' ? 'Starred Stories' : 'Your Stories'}</h1><p>{tab === 'people' ? 'Profiles · Co-players' : tab === 'data' ? 'Import · Export JSON' : 'All moments · Personal archive'}</p></div>
          {tab === 'people' && <button className="primary" onClick={() => setPersonModal({})}>+ Person</button>}
        </div>
        {tab !== 'people' && tab !== 'data' && <>
          <div className="stats">
            <div><b>{stories.length}</b><span>Stories</span></div>
            <div><b>{profiles.length}</b><span>People</span></div>
            <div><b>{games.length}</b><span>Games</span></div>
            <div><b>{stories.filter(s => s.starred).length}</b><span>Starred</span></div>
          </div>
          <div className="filterbar">
            <button className={gameFilter === 'all' ? 'active' : ''} onClick={() => setGameFilter('all')}>All</button>
            {games.map(g => <button className={gameFilter === g ? 'active' : ''} key={g} onClick={() => setGameFilter(g)}>{g}</button>)}
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="starred">Starred first</option>
            </select>
          </div>
          {!!tags.length && <div className="filterbar tags"><span>Tags:</span>{tags.map(t => <button className={tagFilter === t ? 'active tag-filter' : 'tag-filter'} key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}>{t}</button>)}</div>}
          <div className="feed">
            {visibleStories.map(story => <StoryCard key={story.id} story={story} profiles={profiles} onEdit={setStoryModal} onToggleStar={story => act(() => api(`/api/stories/${story.id}`, { method: 'PATCH', body: { ...story, starred: !story.starred } }))} onTag={t => { navigate('feed'); setTagFilter(t); }} onGame={g => { navigate('feed'); setGameFilter(g || 'all'); }} onProfile={id => { navigate('people', id); }} />)}
            {!visibleStories.length && <div className="empty">No stories yet вЂ” add one above</div>}
          </div>
        </>}
        {tab === 'people' && <PeopleView profiles={profiles} stories={stories} selectedId={selectedProfile} setSelectedId={setSelectedProfile} onAdd={() => setPersonModal({})} onEdit={setPersonModal} onDelete={id => act(() => api(`/api/people/${id}`, { method: 'DELETE' }))} storyActions={{ onEdit: setStoryModal, onToggleStar: story => act(() => api(`/api/stories/${story.id}`, { method: 'PATCH', body: { ...story, starred: !story.starred } })), onTag: t => { navigate('feed'); setTagFilter(t); }, onGame: g => { navigate('feed'); setGameFilter(g || 'all'); } }} />}
        {tab === 'data' && <DataView people={profiles} stories={stories} onImport={payload => act(async () => { await api('/api/import', { method: 'POST', body: payload }); })} />}
      </main>
      {storyModal && <StoryModal profiles={profiles} gameSuggestions={gameSuggestions} tagSuggestions={tagSuggestions} story={storyModal.id ? storyModal : null} onCreatePerson={createPersonFromStory} onClose={() => setStoryModal(null)} onDelete={id => act(async () => { await api(`/api/stories/${id}`, { method: 'DELETE' }); setStoryModal(null); })} onSave={story => act(async () => { await api(story.id ? `/api/stories/${story.id}` : '/api/stories', { method: story.id ? 'PATCH' : 'POST', body: story }); setStoryModal(null); })} />}
      {personModal && <PersonModal gameSuggestions={gameSuggestions} person={personModal.id ? personModal : null} onClose={() => setPersonModal(null)} onDelete={id => act(async () => { await api(`/api/people/${id}`, { method: 'DELETE' }); setPersonModal(null); })} onSave={person => act(async () => { await api(person.id ? `/api/people/${person.id}` : '/api/people', { method: person.id ? 'PATCH' : 'POST', body: person }); setPersonModal(null); })} />}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
