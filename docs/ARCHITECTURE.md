# Architecture

Last updated: 2026-10-16, after stages 1 and 2.

## Idea in one paragraph

Gamefolk is a local-first web app. Everything runs in the browser, data is stored in IndexedDB and is always encrypted with WebCrypto. The whole app builds into one file, `gamefolk.html`, that opens with a double click. A small sync server is planned for stage 4; it will only ever receive ciphertext.

## Folders

```
gamefolk.html          built app, the file users open
scripts/build.mjs      esbuild bundle + inlining into one HTML file + CSP hashes
src/
  index.html           page template (CSP, inline CSS and JS go here)
  main.jsx             entry point
  app/                 app state and wiring
    App.jsx            vault screens vs. the open journal, dialogs, shortcuts
    useVault.js        create / open / lock / auto-lock the vault
    useData.js         people and stories in memory, saved through the repo
    router.js          hash routes: #/feed #/starred #/people[/id] #/data
    i18n.js            all UI text, Russian and English
    context.js         React context shared by screens
  core/                plain JS, no React, covered by tests
    crypto.js          WebCrypto wrappers, recovery key format
    vault.js           data key and its wrapped copies
    repo.js            encrypted records, images, draft
    db.js              IndexedDB wrapper
    model.js           shapes of person and story, input cleanup
    dates.js           exact and approximate dates
    search.js          filters, search, sort, counts, suggestions
    images.js          image compression in the browser
    sample.js          example data
  ui/                  React screens and components
  styles/              tokens (colors, fonts), base, layout, components
  assets/fonts/        Exo 2 and Onest, subset to Latin and Cyrillic
tests/                 node:test tests for core/ (npm test)
```

## Encryption

- One random **data key** (AES-256-GCM) encrypts every record and image.
- The data key is stored only wrapped:
  - by a **device key**: a non-exportable CryptoKey kept in IndexedDB, so the app opens by itself on this device;
  - or by a **passcode** (PBKDF2-SHA256, 600 000 iterations, OWASP 2023). When a passcode is on, the device copy is deleted;
  - always by the **recovery key**: 160 random bits shown to the user once as 32 Crockford base32 characters (HKDF-SHA256).
- Each record is encrypted with its own random IV and an additional-data label `kind:id`, so records cannot be swapped or moved.
- Forgot passcode: the recovery key opens the vault and turns the passcode off.
- Auto-lock (5 to 60 minutes) works only with a passcode. Locking unmounts the journal, which drops decrypted data and image URLs from memory.

## Storage

IndexedDB database `gamefolk`, stores:

| Store | Key | Value |
| --- | --- | --- |
| meta | `vault` | wrapped data keys, settings, encrypted recovery key text |
| meta | `deviceKey` | non-exportable CryptoKey |
| meta | `draft` | encrypted draft of a new story |
| records | record id | `{ kind: 'person' or 'story', box: { iv, data } }` |
| blobs | image id, `<id>.thumb` | `{ type, box }` encrypted image bytes |

Unused images are removed when the vault opens.

Theme and language are stored in localStorage, they are not secret.

## Data shapes

- Person: `firstName, lastName, status (free text), games[], nicks[{game, nick}], contacts[{label, value}], note, met{text, game, when}, photo`.
- Story: `title, text, game, tags[], people[ids], names[] (just names), randomPlayers, when, starred, images[{id, width, height}]`.
- `when` is `{ kind: 'exact', date }` or `{ kind: 'approx', year, season|null }` or `null`.

All input goes through `cleanPerson` / `cleanStory` (trimming, limits, max 6 images).

## Page security

The built page has a Content Security Policy in a meta tag:
scripts and styles only by sha256 hash of the inlined code, fonts and images only from `data:` and `blob:`, `connect-src 'none'`. The page cannot load or send anything over the network. Contact links are rendered only for `http(s)` URLs. React escapes all text; there is no raw HTML injection anywhere.

## Build

`npm run build` bundles `src/main.jsx` with esbuild (React automatic JSX, minified IIFE), inlines CSS and JS into `src/index.html`, and writes the CSP hashes. Fonts are embedded as data URLs. Output size is about 430 KB.

## Tests

`npm test` runs `tests/*.test.js` with the built-in Node test runner: crypto round trips, wrong keys, vault modes, recovery, encrypted storage, dates, search, filters, suggestions, input cleanup. The UI was checked with Playwright in Chromium on desktop (1280x900) and phone (390x844) sizes.

## Next stages

3. Backups: encrypted `.memory` file, reminders, restore, "export everything" as a readable archive.
4. Sync and login: Netlify Functions + Blobs, Google login and passkeys, device approval, the server stores only ciphertext.
5. Final review: independent security and usability check, fixes, final docs.
