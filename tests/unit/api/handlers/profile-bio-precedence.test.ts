/**
 * Guards where a Chive profile's bio comes from.
 *
 * @remarks
 * A researcher's Bluesky description is a personal one and often not
 * professional, so it is the weakest source. Their sifa.id summary is written
 * for exactly this audience and sits above it. A bio written on Chive itself is
 * the researcher saying what they want said here, and beats both.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const handler = readFileSync(
  join(process.cwd(), 'src/api/handlers/xrpc/author/getProfile.ts'),
  'utf8'
);

describe('bio precedence', () => {
  it('prefers the Chive bio over everything', () => {
    expect(handler).toMatch(/bioSource === 'chive'\s*\?\s*profileData\.bio/);
  });

  it('falls back to sifa before Bluesky', () => {
    // `profileData.bio` at this point holds the Bluesky description, since a
    // Chive bio was handled by the branch above.
    expect(handler).toMatch(/sifaRead\?\.about \?\? sifaRead\?\.headline \?\? profileData\?\.bio/);
  });

  it('records which source supplied the bio', () => {
    // Without this the handler cannot tell a Bluesky bio from a Chive one, and
    // sifa has nowhere to slot in.
    expect(handler).toContain("result.bioSource = 'bluesky'");
    expect(handler).toContain("result.bioSource = 'chive'");
  });

  it('sends the rich bio only alongside the bio it renders', () => {
    // Rich items describe one specific string; pairing them with a bio from a
    // different source would render the wrong text.
    expect(handler).toMatch(/bioSource === 'chive' && profileData\.bioRich/);
  });
});

describe('rich bio uses the same item union as reviews and abstracts', () => {
  const profileLexicon = JSON.parse(
    readFileSync(join(process.cwd(), 'lexicons/pub/chive/actor/profile.json'), 'utf8')
  ) as {
    defs: { main: { record: { properties: Record<string, { items?: { refs?: string[] } }> } } };
  };
  const submission = JSON.parse(
    readFileSync(join(process.cwd(), 'lexicons/pub/chive/eprint/submission.json'), 'utf8')
  ) as {
    defs: { main: { record: { properties: Record<string, { items?: { refs?: string[] } }> } } };
  };

  it('matches the abstract union exactly', () => {
    const bioRefs = profileLexicon.defs.main.record.properties.bioRich?.items?.refs;
    const abstractRefs = submission.defs.main.record.properties.abstract?.items?.refs;

    expect(bioRefs).toBeDefined();
    expect(bioRefs).toEqual(abstractRefs);
  });

  it('keeps a plain-text bio beside it', () => {
    // Meta descriptions, OG images and search want a string, not an item array.
    expect(profileLexicon.defs.main.record.properties.bio).toBeDefined();
  });
});
