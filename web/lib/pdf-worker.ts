/**
 * Location of the pdf.js worker.
 *
 * @remarks
 * The worker is served from our own origin, copied out of the installed
 * `pdfjs-dist` by `scripts/copy-pdf-worker.mjs` before `dev` and `build`. It
 * used to be loaded from `cdn.jsdelivr.net`, which the app's own
 * Content-Security-Policy blocks — `script-src` is `'self'` — so every document
 * failed with "Setting up fake worker failed: Failed to fetch dynamically
 * imported module". Allowing a CDN in `script-src` instead would permit
 * third-party script to execute on every eprint page.
 *
 * Because the file is copied from the resolved dependency, it cannot drift from
 * the `pdfjs-dist` that `react-pdf` and `react-pdf-highlighter-extended` load;
 * a mismatch between worker and main-thread build is its own failure mode.
 *
 * @public
 */
export const PDF_WORKER_SRC = '/pdfjs/pdf.worker.min.mjs';
