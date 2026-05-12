# Storyline deployment

## Security status

Storyline encrypts private archive data before saving it to the database with AES-256-GCM. In production, use PostgreSQL through `DATABASE_URL`. If `DATABASE_URL` is empty, the app falls back to local SQLite for development.

Encrypted:

- story title
- story text
- game
- tags
- linked people ids
- raw people names in stories
- story date
- person first name
- person last name
- person games
- person description
- person "met" field

Not encrypted because the server needs it for auth/session logic:

- account email
- account display name
- Google account id
- password hash
- session token hash
- password reset token hash
- session IP/user-agent metadata
- row ids and created/updated timestamps
- starred flag, accent, random player count

Passwords are not stored as plaintext. They are hashed with scrypt. Session and reset tokens are stored as hashes.

If someone steals only the database file, the private archive fields are encrypted. If someone steals the server secrets too, especially `APP_ENCRYPTION_KEY`, they can decrypt the private data. Keep `.env` out of Git and store secrets only in hosting provider environment variables.

## Recommended hosting

The simplest working deployment is:

- PostgreSQL on Supabase or Neon.
- One Render Web Service that serves both the Node API and the built React app.

Netlify is good for the React frontend, but this project also needs a real backend and persistent storage. If you use Netlify, keep the backend on Render/Koyeb/Fly/Railway and proxy `/api/*` to it.

Do not use SQLite on a free web service for important data. Local files on free app hosts are often not durable enough for a private archive.

## Create PostgreSQL

Supabase is a convenient free option.

1. Create a Supabase account.
2. Create a new project.
3. Open `Project Settings` -> `Database`.
4. Copy the pooled connection string. It usually starts with:

   ```text
   postgresql://...
   ```

5. Replace the password placeholder with your real database password.
6. Keep this value secret. It will be `DATABASE_URL`.

## Render only

1. Push this project to GitHub.

2. Create a Render account and click `New` -> `Web Service`.

3. Connect the GitHub repository.

4. Set:

   ```text
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: node server/server.js
   ```

5. Add environment variables:

   ```env
   NODE_ENV=production
   HOST=0.0.0.0
   APP_ORIGIN=https://YOUR-APP.onrender.com
   PUBLIC_APP_URL=https://YOUR-APP.onrender.com
   DATABASE_URL=postgresql://...
   DATABASE_SSL=true
   APP_ENCRYPTION_KEY=PASTE_GENERATED_KEY_HERE
   SESSION_SECRET=PASTE_GENERATED_SECRET_HERE
   ```

6. Generate secrets locally:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Run it twice. Use one value for `APP_ENCRYPTION_KEY` and the other for `SESSION_SECRET`.

7. Deploy.

## Google login on Render

1. Open Google Cloud Console.
2. Create/select a project.
3. Open `APIs & Services` -> `OAuth consent screen` and configure the app.
4. Open `Credentials` -> `Create credentials` -> `OAuth client ID`.
5. Choose `Web application`.
6. Add this authorized redirect URI:

   ```text
   https://YOUR-APP.onrender.com/api/auth/google/callback
   ```

7. Add these variables in Render:

   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://YOUR-APP.onrender.com/api/auth/google/callback
   ```

## Netlify frontend + Render backend

First create PostgreSQL, then deploy the backend to Render. Suppose its URL is:

```text
https://storyline-api.onrender.com
```

Then deploy the frontend to Netlify:

1. Create `netlify.toml` in the project root:

   ```toml
   [build]
     command = "npm run build"
     publish = "dist"

   [[redirects]]
     from = "/api/*"
     to = "https://storyline-api.onrender.com/api/:splat"
     status = 200
     force = true
   ```

2. In Netlify, click `Add new site` -> `Import an existing project`.

3. Connect the GitHub repository.

4. Set:

   ```text
   Build command: npm run build
   Publish directory: dist
   ```

5. After Netlify gives you a URL, set these variables on the Render backend:

   ```env
   APP_ORIGIN=https://YOUR-SITE.netlify.app
   PUBLIC_APP_URL=https://YOUR-SITE.netlify.app
   ```

6. For Google login through Netlify, use this redirect URI:

   ```text
   https://YOUR-SITE.netlify.app/api/auth/google/callback
   ```

   And set this in Render:

   ```env
   GOOGLE_REDIRECT_URI=https://YOUR-SITE.netlify.app/api/auth/google/callback
   ```

## Minimum safety checklist

- Use HTTPS only.
- Do not commit `.env`.
- Use long random values for `APP_ENCRYPTION_KEY` and `SESSION_SECRET`.
- Never rotate `APP_ENCRYPTION_KEY` without a migration plan, or old encrypted data will become unreadable.
- Enable 2FA on GitHub, Render, Netlify, Google.
- Export JSON backups from the app regularly.
- Keep PostgreSQL backups enabled when your provider supports them.
