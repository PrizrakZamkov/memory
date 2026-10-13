// Builds the whole app into one self-contained file: gamefolk.html.
// Open it with a double click, no server needed.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

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

// The page may only run its own code and never talks to the network.
const csp = [
  "default-src 'none'",
  `script-src ${hash(js)}`,
  `style-src ${hash(css)}`,
  'font-src data:',
  'img-src blob: data:',
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

const template = await readFile('src/index.html', 'utf8');
const html = template
  .replace('%CSP%', csp)
  .replace('%CSS%', () => css)
  .replace('%JS%', () => js);

await writeFile('gamefolk.html', html);
console.log(`gamefolk.html: ${(html.length / 1024).toFixed(0)} KB`);
