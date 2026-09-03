/**
 * The site's own share card must point at a route that exists.
 *
 * @remarks
 * The metadata named `/og`; the generator lives at `/api/og`. Nothing 404s
 * visibly in an unfurl — a client asks for the image, gets nothing, and shows
 * the card without one. Eprint pages looked right the whole time because they
 * build their path from the generator directly, so the only broken card was the
 * one for the site itself.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8');

describe('root openGraph image', () => {
  it('points at the generator route', () => {
    expect(layout).toContain("const DEFAULT_OG_PATH = '/api/og?type=default'");
  });

  it('never references a bare /og path', () => {
    expect(layout).not.toMatch(/absoluteUrl\(\s*'\/og'\s*\)/);
  });

  it('uses the same constant for openGraph and twitter', () => {
    // Two literals are how the two came to disagree in the first place.
    const uses = layout.match(/absoluteUrl\(DEFAULT_OG_PATH\)/g) ?? [];
    expect(uses.length).toBe(2);
  });
});
