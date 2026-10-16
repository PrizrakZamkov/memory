# Architecture

Last updated: 2026-10-17, after stages 3 and 4.

## Idea in one paragraph

Gamefolk is a local-first web app. Everything runs in the browser, data is stored in IndexedDB and is always encrypted with WebCrypto. The whole app builds into one file, `gamefolk.html`, that opens with a double click. When the same page is served from Netlify, it can sync through a small server that only ever receives ciphertext. Backups are encrypted files; "export everything" makes a readable zip.

## Folders

```
gamefolk.html          built app, the file users open
dist/                  build output for Netlify (index.html + _headers), not in git
netlify.toml           Netlify build settings
netlify/functions/     two Netlify Functions: api.mjs (/api/*) and auth.mjs (/api/auth/*)
server/
  handler.js           the whole API as (Request) => Response
  stores.js            storage adapters: Netlify Blobs and in-memory
  netlify.js           builds the handler with Netlify secrets
scripts/build.mjs      esbuild bundle, inline into one HTML file, CSP hashes, _headers
src/
  index.html           page template
  main.jsx             entry point
  app/                 app state and wiring
    App.jsx            vault screens vs. the open journal, dialogs, shortcuts, login redirect
    useVault.js        create / open / lock / restore / join account
    useData.js         people, stories, profile in memory, saved through the repo
    useSync.js         sync loop, device requests, sign out
    router.js          hash routes: #/feed #/starred #/people[/id] #/data
    i18n.js            all UI text, Russian and English, time and greeting helpers
  core/                plain JS, no React, covered by tests
    crypto.js          WebCrypto wrappers, recovery key format
    vault.js           data key, its wrapped copies, vault header, re-keying
    repo.js            encrypted records (with change time and tombstones), images, draft, profile
    db.js              IndexedDB wrapper
    model.js           shapes of person and story, input cleanup
    dates.js           exact and approximate dates
    search.js          filters, search, sort, counts, suggestions, "on this day"
    images.js          image compression in the browser
    backup.js          encrypted .gamefolk files: create, read, restore, merge
    archive.js         readable export: book.html, data.json, stories/*.md, images
    zip.js             minimal zip writer
    api.js             fetch wrapper for the sync server
    sync.js            pull / push of encrypted rows, joining an account
    pairing.js         moving the data key to a new device with ECDH
    encoding.js        base64 helpers
    sample.js          example data
  ui/                  React screens and components, motion helpers, drawings
  styles/              tokens (colors, fonts), base, layout, components
  assets/fonts/        Exo 2 and Onest, subset to Latin and Cyrillic
tests/                 node:test tests (npm test)
docs/DEPLOY.md         step-by-step Netlify and Google setup, in Russian
```

## Encryption

- One random **data key** (AES-256-GCM) encrypts every record and image.
- The data key is stored only wrapped:
  - by a **device key**: a non-exportable CryptoKey in IndexedDB, so the app opens by itself on this device;
  - or by a **passcode** (PBKDF2-SHA256, 600 000 iterations, OWASP). With a passcode on, the device copy is deleted;
  - always by the **recovery key**: 160 random bits shown once as 32 Crockford base32 characters (HKDF-SHA256).
- The **vault header** is the recovery-wrapped data key plus the recovery key text encrypted by the data key. It is safe to copy, so it goes into backups and to the server. `keyMatchesHeader` checks that a key belongs to a header.
- Each record has its own IV and an additional-data label `kind:id`, so records cannot be swapped or moved.
- Forgot passcode: the recovery key opens the vault and turns the passcode off.
- Auto-lock (5 to 60 minutes) works with a passcode. Locking unmounts the journal and drops decrypted data and image URLs from memory.

## Storage

IndexedDB database `gamefolk`:

| Store | Key | Value |
| --- | --- | --- |
| meta | `vault` | wrapped data keys, header, settings, last backup time |
| meta | `deviceKey` | non-exportable CryptoKey |
| meta | `draft`, `profile` | encrypted draft of a new story, encrypted user name |
| meta | `sync` | sync state: account email, server etags, what was pushed |
| records | record id | `{ kind, box, t }` or a tombstone `{ kind, deleted: true, t }` |
| blobs | image id, `<id>.thumb` | `{ type, box }` encrypted image bytes |

`t` is the time of the last change, used for sync. Unused images are removed when the vault opens (and from the server, when synced).

## Backups and export

- `.gamefolk` backup: JSON with the vault header, all record boxes and image boxes, exactly as stored. Restoring on a new device needs the recovery key. Merging into an existing vault re-encrypts if the keys differ, adds missing records, replaces older ones and never deletes.
- Reminder in the feed when sync is off and the last backup is older than 7 days.
- Export everything: a stored (uncompressed) zip with `book.html` (no scripts, all text escaped), `data.json`, `stories/*.md` and `images/`. Not encrypted; the UI says so.

## Sync server

One handler, `server/handler.js`, deployed as two Netlify Functions with different request limits (240 per minute for the API, 20 per minute for login, per IP).

- **Login**: Google OpenID Connect, authorization code flow with `state`, `nonce` and PKCE (S256). The ID token comes straight from Google's token endpoint with our client secret, so its claims are trusted without signature checks; `iss`, `aud`, `exp`, `nonce` and `email_verified` are checked. Accounts are keyed by a hash of Google's `sub`, never by email.
- **Sessions**: 32 random bytes in `__Host-gf_session` (HttpOnly, Secure, SameSite=Strict, 30 days). Only the SHA-256 of the token is stored. Each session is a device that can be signed out.
- **Write protection**: every non-GET request must have the site's Origin and `X-Requested-With: gamefolk`.
- **Data**: records are `{ kind, t, deleted, box }`; the server keeps last-write-wins by `t` with conditional writes, so an older change never overwrites a newer one. Images are write-once. Limits: 400 KB per record, about 3.3 MB per image, 20 000 records and 5 000 images per account.
- **Storage keys** (Netlify Blobs, strong consistency): `google/<sha256(sub)>`, `user/<uid>`, `sess/<sha256(token)>`, `dev/<uid>/<device>`, `vault/<uid>`, `rec/<uid>/<id>`, `img/<uid>/<id>`, `pair/<uid>/<id>`.
- **What the server can see**: the email, devices, change times and sizes. It cannot read records, images or keys.
- **Honest limit**: like every web app, the page code itself comes from the server. Encryption protects against leaks of stored data, not against someone who takes over the hosting and changes the code.

## Joining a device

- After login, `connectAccount` uploads the header if the account is new. If the account already has a header with another key, this device must join.
- **Pairing**: the new device makes an ECDH P-256 key pair and shows an 8-character code from the hash of its public key. The old device shows the same code, the user compares and approves. The old device derives a shared key (ECDH, HKDF-SHA256) and sends the data key wrapped with it. The server only passes public keys and the wrapped key; requests expire in 10 minutes.
- **Recovery key**: unwraps the header from the server.
- `joinAccount` re-encrypts the device's own records with the account key and merges them in.

## Sync loop

`syncOnce`: list server etags, fetch changed records, keep the newer `t`, upload images not yet pushed, upload changed rows; on a conflict, pull again. Runs on open, 2.5 s after a local change, every 45 s while the tab is visible, on focus and when the network returns. Pairing requests are checked every 15 s. Images are downloaded only when shown. When the app is opened as a file there is no server, so the sync section is hidden.

## Page security

The page has a Content Security Policy (meta tag in the file, header on Netlify): scripts and styles only by sha256 hash of the inlined code, fonts and images only from `data:` and `blob:`, network only to its own origin (`connect-src 'self'`), no framing (header). On Netlify there are also HSTS, nosniff, no referrer and a strict Permissions-Policy. React escapes all text; contact links render only for `http(s)` URLs.

## Interface

Dark "Ice" theme by default, light theme, Russian and English. Motion is short and uses transform and opacity: cards rise in a stagger, filter changes rearrange cards with View Transitions, the star throws sparks, counters count up, dialogs open with a light spring, images shimmer while decrypting. Everything turns off with "reduce motion". Phones get a bottom bar with a big add button and full-screen dialogs.

## Tests

`npm test` runs `tests/*.test.js`: crypto, vault, storage, dates, search, backups, zip, export escaping, the server (login checks, origin checks, last-write-wins, isolation between accounts, input validation, pairing, device sign-out, account deletion, session expiry) and sync between two devices through the real handler. The UI is checked with Playwright in Chromium on desktop and phone sizes, offline from the file and online with a local server and a fake Google.

## Next

5. Final review: an independent security and usability check, fixes, final docs. Ideas for later: passkeys, sharing one story by link, a timeline by years.
