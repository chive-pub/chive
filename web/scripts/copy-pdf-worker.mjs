/**
 * Copies the pdf.js worker into `public/` so it is served from our own origin.
 *
 * @remarks
 * The viewers used to load the worker from `cdn.jsdelivr.net`. That stopped
 * working the moment the app got a Content-Security-Policy: `script-src` is
 * `'self'`, so the worker's dynamic import was blocked and every document
 * failed with "Setting up fake worker failed". Whitelisting a CDN in
 * `script-src` would buy back the ability to execute third-party script on
 * every eprint page, which is the one thing that directive is for.
 *
 * Copying the file the application already depends on avoids both problems: the
 * worker is same-origin, it is always the exact version `pdfjs-dist` resolves
 * to, and the viewer no longer depends on a third party being reachable.
 *
 * Runs before `dev` and `build`.
 */

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Resolve through the package rather than a hardcoded path, so a hoisted or
// pnpm-linked install is found the same way the bundler finds it.
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const version = JSON.parse(readFileSync(join(pdfjsRoot, 'package.json'), 'utf8')).version;

const source = join(pdfjsRoot, 'build', 'pdf.worker.min.mjs');
const destDir = join(webRoot, 'public', 'pdfjs');
const dest = join(destDir, 'pdf.worker.min.mjs');

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);

console.log(`Copied pdf.js worker ${version} to public/pdfjs/pdf.worker.min.mjs`);
