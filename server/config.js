import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

if (existsSync('.env')) {
  const lines = readFileSync('.env', 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  appOrigin: process.env.APP_ORIGIN || 'http://127.0.0.1:5173',
  publicAppUrl: process.env.PUBLIC_APP_URL || 'http://127.0.0.1:5173',
  databasePath: resolve(process.env.DATABASE_PATH || './data/storyline.sqlite'),
  sessionSecret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  encryptionKey: process.env.APP_ENCRYPTION_KEY || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:4000/api/auth/google/callback'
};

export const isProd = config.env === 'production';
