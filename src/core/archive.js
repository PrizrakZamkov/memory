// "Export everything": a readable archive that does not need Gamefolk to open.
// Contains book.html (open in any browser), data.json, one text file per story and the images.
import { formatWhen, sortKey } from './dates.js';
import { fullName } from './model.js';

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'story';
}

function imagePath(id, type) {
  return `images/${id}.${EXT[type] || 'img'}`;
}

function storyMarkdown(story, people, lang) {
  const lines = [`# ${story.title}`, ''];
  const meta = [
    story.when && formatWhen(story.when, lang),
    story.game,
    [...people.map(fullName), ...story.names].join(', ')
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join(' | '), '');
  if (story.text) lines.push(story.text, '');
  if (story.tags.length) lines.push(story.tags.map(t => `#${t}`).join(' '), '');
  return lines.join('\n');
}

const BOOK_CSS = `
body{margin:0;background:#f5f2ec;color:#1d1d1f;font:17px/1.65 Georgia,'Times New Roman',serif}
main{max-width:720px;margin:0 auto;padding:48px 20px 96px}
h1{font-size:40px;margin:0 0 4px}h2{font-size:26px;margin:56px 0 8px}h3{font-size:22px;margin:0 0 4px}
.meta{color:#6b6459;font:15px/1.5 system-ui,sans-serif;margin:0 0 12px}
article{padding:28px 0;border-top:1px solid #ddd5c8}
p{white-space:pre-line;margin:0 0 12px}
.imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin:12px 0}
.imgs img{width:100%;border-radius:8px}
.person{padding:20px 0;border-top:1px solid #ddd5c8}
.kv{font:15px/1.6 system-ui,sans-serif;color:#3d3830}`;

function bookHtml({ people, stories, peopleById, images, lang, title }) {
  const t = lang === 'ru'
    ? { stories: 'Истории', people: 'Люди', met: 'Как познакомились', nicks: 'Ники', contacts: 'Контакты', note: 'Заметка', made: 'Выгружено из Gamefolk' }
    : { stories: 'Stories', people: 'People', met: 'How we met', nicks: 'Nicks', contacts: 'Contacts', note: 'Note', made: 'Exported from Gamefolk' };

  const storyBlocks = stories.map(story => {
    const who = [...story.people.map(id => peopleById.get(id)).filter(Boolean).map(fullName), ...story.names];
    const meta = [story.when && formatWhen(story.when, lang), story.game, who.join(', ')].filter(Boolean).map(escapeHtml).join(' &middot; ');
    const pics = story.images
      .filter(img => images.has(img.id))
      .map(img => `<img src="${imagePath(img.id, images.get(img.id))}" alt="" loading="lazy">`).join('');
    return `<article><h3>${escapeHtml(story.title)}</h3><div class="meta">${meta}</div>`
      + (story.text ? `<p>${escapeHtml(story.text)}</p>` : '')
      + (pics ? `<div class="imgs">${pics}</div>` : '')
      + (story.tags.length ? `<div class="meta">${story.tags.map(x => `#${escapeHtml(x)}`).join(' ')}</div>` : '')
      + '</article>';
  }).join('\n');

  const personBlocks = people.map(person => {
    const rows = [];
    if (person.met.text || person.met.when) rows.push(`<div class="kv"><b>${t.met}:</b> ${escapeHtml([person.met.when && formatWhen(person.met.when, lang), person.met.game, person.met.text].filter(Boolean).join(', '))}</div>`);
    if (person.nicks.length) rows.push(`<div class="kv"><b>${t.nicks}:</b> ${person.nicks.map(n => escapeHtml(`${n.nick} (${n.game})`)).join(', ')}</div>`);
    if (person.contacts.length) rows.push(`<div class="kv"><b>${t.contacts}:</b> ${person.contacts.map(c => escapeHtml(`${c.label}: ${c.value}`)).join(', ')}</div>`);
    if (person.note) rows.push(`<div class="kv"><b>${t.note}:</b> ${escapeHtml(person.note)}</div>`);
    const photo = person.photo && images.has(person.photo)
      ? `<img src="${imagePath(person.photo, images.get(person.photo))}" alt="" style="width:72px;height:72px;border-radius:50%;float:right;object-fit:cover">` : '';
    return `<div class="person">${photo}<h3>${escapeHtml(fullName(person))}</h3>`
      + (person.status ? `<div class="meta">${escapeHtml(person.status)}</div>` : '') + rows.join('') + '</div>';
  }).join('\n');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>${escapeHtml(title)}</title><style>${BOOK_CSS}</style></head><body><main>`
    + `<h1>${escapeHtml(title)}</h1><div class="meta">${t.made}, ${new Date().toLocaleDateString(lang)}</div>`
    + `<h2>${t.stories}</h2>${storyBlocks}<h2>${t.people}</h2>${personBlocks}</main></body></html>`;
}

// loadImage(id) -> { type, bytes } | null
export async function buildArchiveFiles({ people, stories, loadImage, lang, title }) {
  const peopleById = new Map(people.map(p => [p.id, p]));
  const sorted = [...stories].sort((a, b) => sortKey(b.when).localeCompare(sortKey(a.when)));
  const files = [];
  const images = new Map();

  const wanted = [
    ...people.map(p => p.photo).filter(Boolean),
    ...sorted.flatMap(s => s.images.map(img => img.id))
  ];
  for (const id of wanted) {
    if (images.has(id)) continue;
    const image = await loadImage(id);
    if (!image) continue;
    images.set(id, image.type);
    files.push({ name: imagePath(id, image.type), data: image.bytes });
  }

  files.push({ name: 'book.html', data: bookHtml({ people, stories: sorted, peopleById, images, lang, title }) });
  files.push({ name: 'data.json', data: JSON.stringify({ exportedAt: new Date().toISOString(), people, stories: sorted }, null, 2) });

  const used = new Set();
  for (const story of sorted) {
    const base = `${(story.when && sortKey(story.when).slice(0, 10)) || 'undated'}-${slug(story.title)}`;
    let name = `stories/${base}.md`;
    for (let i = 2; used.has(name); i++) name = `stories/${base}-${i}.md`;
    used.add(name);
    const storyPeople = story.people.map(id => peopleById.get(id)).filter(Boolean);
    files.push({ name, data: storyMarkdown(story, storyPeople, lang) });
  }
  return files;
}
