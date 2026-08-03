/**
 * Copies the single-file web build into the Expo project so it ships inside the
 * iOS app bundle.
 *
 * Run via `npm run build:mobile`. The Expo app imports the result with
 * `require('./assets/web/index.html')`, so this must complete before any
 * `eas build`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'dist-mobile/index.html');
const target = resolve(root, 'mobile/assets/web/index.html');

if (!existsSync(source)) {
  console.error(`Missing ${source}. Run: BUILD_TARGET=mobile vite build`);
  process.exit(1);
}

const html = readFileSync(source, 'utf8');

// A single-file build has no sibling files to resolve against. Any src/href in
// the markup that is not a data: URI or an in-page fragment would 404 inside
// the WebView, silently losing fonts, icons, or the app itself.
//
// Inline script bodies are excluded first: minified JS is full of string
// concatenation that otherwise reads as an attribute.
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '<script></script>');
const dangling = [...markup.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)]
  .map((m) => m[1])
  .filter((ref) => !ref.startsWith('data:') && !ref.startsWith('#'));
if (dangling.length > 0) {
  console.error('Bundle is not self-contained; these still reference external files:');
  for (const ref of dangling) console.error(`  ${ref}`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, html);

const mb = (html.length / 1024 / 1024).toFixed(2);
console.log(`Wrote mobile/assets/web/index.html (${mb} MB, self-contained)`);
