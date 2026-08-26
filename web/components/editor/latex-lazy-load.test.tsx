/**
 * Tests for deferring the KaTeX bundle until LaTeX is actually rendered.
 *
 * @remarks
 * KaTeX is roughly 280KB and was imported at the top of `rich-text-renderer`,
 * so every route rendering any rich text shipped it — browse, search, trending
 * and author listings included. None of those typically contain a formula; the
 * eprint card renders a title and an abstract excerpt.
 *
 * It now loads on first use, which moves it into its own chunk. Two properties
 * matter and are asserted against the source, because a static import is a
 * build-graph fact rather than a runtime behaviour: there is no top-level
 * import, and the dynamic one is inside the render path.
 *
 * The fallback matters too. Until the chunk resolves — and if it never does,
 * because a user is offline or the asset 404s after a deploy — the LaTeX source
 * is shown rather than an empty span. That is readable on its own and occupies
 * roughly the right space, so the layout does not jump when it swaps.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'components/editor/rich-text-renderer.tsx'),
  'utf8'
);

describe('KaTeX is not in the static bundle', () => {
  it('has no top-level katex import', () => {
    expect(source).not.toMatch(/^import .*from 'katex';$/m);
  });

  it('imports it dynamically instead', () => {
    expect(source).toMatch(/import\('katex'\)/);
  });

  // A cached promise rather than a cached module, so concurrent renders on one
  // page share a single request instead of racing.
  it('caches the load so repeated formulae do not refetch', () => {
    expect(source).toMatch(/katexModule \?\?= import\('katex'\)/);
  });
});

describe('rendering degrades readably', () => {
  it('shows the LaTeX source until the chunk resolves', () => {
    expect(source).toMatch(/if \(html === null\)/);
    expect(source).toMatch(/\{item\.content\}/);
  });

  it('handles a failed chunk load rather than leaving it pending', () => {
    expect(source).toMatch(/\.catch\(\(\) => \{/);
  });

  // Unmounting mid-load must not set state on a gone component.
  it('ignores a resolution that arrives after unmount', () => {
    expect(source).toMatch(/let active = true;/);
    expect(source).toMatch(/active = false;/);
  });
});
