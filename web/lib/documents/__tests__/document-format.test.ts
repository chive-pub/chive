/**
 * Tests for document format detection and the worker origin.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PDF_WORKER_SRC } from '@/lib/pdf-worker';
import {
  detectDocumentFormat,
  formatExtension,
  isPdfFormat,
  isTextFormat,
} from '@/lib/documents/document-format';

const webRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

describe('pdf.js worker', () => {
  it('is served from our own origin', () => {
    // A CDN URL is blocked by the app's own CSP (`script-src 'self'`), which is
    // what produced "Setting up fake worker failed: Failed to fetch dynamically
    // imported module" on every document.
    expect(PDF_WORKER_SRC.startsWith('/')).toBe(true);
    expect(PDF_WORKER_SRC).not.toMatch(/^https?:/);
  });

  it('is the only worker source the viewers use', () => {
    for (const file of [
      'components/eprints/pdf-viewer.tsx',
      'components/eprints/pdf-viewer-annotated.tsx',
    ]) {
      const source = readFileSync(join(webRoot, file), 'utf8');
      expect(source).not.toContain('cdn.jsdelivr.net');
      expect(source).toContain('PDF_WORKER_SRC');
    }
  });

  it('is copied by the build, not committed', () => {
    const pkg = JSON.parse(readFileSync(join(webRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    // pnpm's `enable-pre-post-scripts` is not set here, so a `prebuild` script
    // cannot be relied on to run; the copy is part of the command itself.
    expect(pkg.scripts.build).toContain('copy-pdf-worker');
    expect(pkg.scripts.dev).toContain('copy-pdf-worker');
  });
});

describe('detectDocumentFormat', () => {
  it.each([
    ['application/pdf', 'pdf'],
    ['text/markdown', 'markdown'],
    ['text/x-markdown', 'markdown'],
    ['text/html', 'html'],
    ['text/x-tex', 'latex'],
    ['application/x-latex', 'latex'],
    ['application/x-ipynb+json', 'jupyter'],
    ['text/plain', 'txt'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
    ['application/vnd.oasis.opendocument.text', 'odt'],
    ['application/rtf', 'rtf'],
    ['application/epub+zip', 'epub'],
  ])('maps %s to %s', (mime, expected) => {
    expect(detectDocumentFormat(mime)).toBe(expected);
  });

  it('ignores charset parameters', () => {
    expect(detectDocumentFormat('text/markdown; charset=utf-8')).toBe('markdown');
  });

  it('falls back to the filename when the MIME type is generic', () => {
    expect(detectDocumentFormat('application/octet-stream', 'paper.ipynb')).toBe('jupyter');
    expect(detectDocumentFormat(undefined, 'paper.tex')).toBe('latex');
  });

  it('defaults to pdf, which is what every existing eprint is', () => {
    expect(detectDocumentFormat(undefined)).toBe('pdf');
    expect(detectDocumentFormat('application/octet-stream')).toBe('pdf');
  });
});

describe('viewer routing', () => {
  it('sends only PDFs to the annotated PDF viewer', () => {
    expect(isPdfFormat('pdf')).toBe(true);
    for (const format of ['markdown', 'latex', 'html', 'jupyter', 'txt', 'docx'] as const) {
      expect(isPdfFormat(format)).toBe(false);
    }
  });

  it('renders every text format DocumentViewer knows', () => {
    // These are exactly the cases in DocumentViewer's switch, minus pdf.
    for (const format of ['html', 'markdown', 'latex', 'jupyter', 'txt'] as const) {
      expect(isTextFormat(format)).toBe(true);
    }
  });

  it('offers a download for binary formats it cannot render', () => {
    for (const format of ['docx', 'odt', 'rtf', 'epub'] as const) {
      expect(isTextFormat(format)).toBe(false);
      expect(isPdfFormat(format)).toBe(false);
    }
  });
});

describe('formatExtension', () => {
  it.each([
    ['markdown', 'md'],
    ['latex', 'tex'],
    ['jupyter', 'ipynb'],
    ['pdf', 'pdf'],
    ['docx', 'docx'],
    ['txt', 'txt'],
  ])('names %s files .%s', (format, extension) => {
    expect(formatExtension(format)).toBe(extension);
  });
});
