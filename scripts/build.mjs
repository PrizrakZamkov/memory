// Builds the whole app into one self-contained file.
// gamefolk.html opens with a double click; dist/ is the same page for Netlify,
// with strict security headers.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const result = await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  outdir: 'out',
  legalComments: 'none',
  loader: { '.woff': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' }
});

const jsFile = result.outputFiles.find(f => f.path.endsWith('.js'));
const cssFile = result.outputFiles.find(f => f.path.endsWith('.css'));
// A literal "</script" inside the bundle would end the inline script early.
const js = jsFile.text.replaceAll('</script', '<\\/script');
const css = cssFile.text;

const hash = text => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

// The page may only run its own code and talk only to its own server (for sync).
// Opened from a file, there is no server, so nothing leaves the computer.
const csp = [
  "default-src 'none'",
  `script-src ${hash(js)}`,
  `style-src ${hash(css)}`,
  'font-src data:',
  'img-src blob: data:',
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'"
];

const template = await readFile('src/index.html', 'utf8');
const html = template
  .replace('%CSP%', csp.join('; '))
  .replace('%CSS%', () => css)
  .replace('%JS%', () => js);

await writeFile('gamefolk.html', html);

// Headers can do what a meta tag cannot: forbid framing, force HTTPS.
const headers = `/*
  Content-Security-Policy: ${[...csp, "frame-ancestors 'none'"].join('; ')}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Cache-Control: no-cache
`;
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
await writeFile('dist/_headers', headers);

console.log(`gamefolk.html: ${(html.length / 1024).toFixed(0)} KB`);
