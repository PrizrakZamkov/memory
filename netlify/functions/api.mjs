import { netlifyHandler } from '../../server/netlify.js';

export default request => netlifyHandler()(request);

export const config = {
  path: '/api/*',
  excludedPath: '/api/auth/*',
  rateLimit: { windowLimit: 240, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
