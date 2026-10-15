// Login routes: same handler, much stricter request limit.
import { netlifyHandler } from '../../server/netlify.js';

export default request => netlifyHandler()(request);

export const config = {
  path: '/api/auth/*',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
