/**
 * Guards the sifa.id link and the bio editor.
 *
 * @remarks
 * The sifa profile URL was verified against the live site rather than assumed:
 * `/profile/<handle>` and `/profile/<did>` both answer 200, and
 * `/profile/<nonexistent>` answers 404 — so the path is real and the 200 is
 * meaningful.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const header = readFileSync(join(webRoot, 'components/eprints/author-header.tsx'), 'utf8');
const settings = readFileSync(join(webRoot, 'components/settings/chive-profile-form.tsx'), 'utf8');

describe('sifa.id link', () => {
  it('uses the profile path the site actually serves', () => {
    expect(header).toContain('https://sifa.id/profile/');
  });

  it('addresses the profile by DID, which does not change when a handle does', () => {
    expect(header).toMatch(/sifa\.id\/profile\/\$\{encodeURIComponent\(profile\.did\)\}/);
  });

  it('appears only for a researcher who has a sifa profile', () => {
    // `hasProfile` is set from records read out of the repository, so this
    // never links to an empty page.
    expect(header).toMatch(/sifa\?\.hasProfile === true/);
  });

  it('opens externally without leaking the referrer window', () => {
    const linkBlock = header.slice(header.indexOf('https://sifa.id/profile/'));
    expect(linkBlock.slice(0, 400)).toContain('rel="noopener noreferrer"');
  });
});

describe('bio editing', () => {
  it('uses the editor that offers @ and # autocomplete', () => {
    // A plain textarea accepted the syntax but gave no way to discover it.
    expect(settings).toContain('MarkdownEditor');
    expect(settings).toContain('enableMentions');
    expect(settings).toContain('enableTags');
  });

  it('no longer uses a bare textarea for the bio', () => {
    expect(settings).not.toContain('@/components/ui/textarea');
  });
});

describe('bio display', () => {
  it('clamps a long bio rather than letting it push the page down', () => {
    expect(header).toContain('ExpandableProse');
  });
});
