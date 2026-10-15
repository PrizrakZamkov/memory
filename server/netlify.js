// Builds the handler once per function instance, reading secrets from Netlify settings.
import { getStore } from '@netlify/blobs';
import { createHandler } from './handler.js';
import { netlifyStore } from './stores.js';

let handler;

export function netlifyHandler() {
  handler ||= createHandler({
    store: netlifyStore(getStore),
    env: {
      GOOGLE_CLIENT_ID: Netlify.env.get('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: Netlify.env.get('GOOGLE_CLIENT_SECRET'),
      SITE_URL: Netlify.env.get('SITE_URL') || Netlify.env.get('URL')
    }
  });
  return handler;
}
