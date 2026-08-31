/**
 * Tests that list endpoints hydrate a page in one query.
 *
 * @remarks
 * Both of these looped `getEprint(uri)` over their results, so a page of N
 * cost N round-trips to Postgres to read N titles — latency growing with page
 * size, on the two endpoints most likely to be asked for a large page.
 *
 * `getEprints` already existed and issues a single `uri = ANY($1)`. These
 * tests read the source: what is being asserted is the shape of the call, and
 * a mocked run can satisfy an assertion about results either way.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const HANDLERS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'src',
  'api',
  'handlers',
  'xrpc'
);

const SEARCH = readFileSync(join(HANDLERS, 'eprint', 'searchSubmissions.ts'), 'utf8');
const ENDORSEMENTS = readFileSync(join(HANDLERS, 'endorsement', 'listForUser.ts'), 'utf8');

describe('searchSubmissions hydration', () => {
  it('fetches the page with the batch getter', () => {
    expect(SEARCH).toMatch(/eprint\.getEprints\(/);
  });

  it('does not fetch one eprint per hit', () => {
    // The N+1: `hits.map(async (hit) => eprint.getEprint(hit.uri))`.
    expect(SEARCH).not.toMatch(/hits\.map\(async[^)]*\)\s*=>\s*\{[\s\S]{0,200}getEprint\(/);
  });

  it('batches both the LTR-logging path and the response path', () => {
    // Two separate loops existed; only fixing one would leave the endpoint
    // N+1 for queries without text.
    const calls = SEARCH.match(/eprint\.getEprints\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('endorsement listForUser hydration', () => {
  it('fetches eprint titles with the batch getter', () => {
    expect(ENDORSEMENTS).toMatch(/eprint\.getEprints\(/);
  });

  it('no longer calls the single getter inside the result loop', () => {
    expect(ENDORSEMENTS).not.toMatch(/await eprint\.getEprint\(item\.eprintUri\)/);
  });

  it('keeps returning endorsements when the title lookup fails', () => {
    // An endorsement is worth returning without the title of the paper it is
    // about, and the eprint may genuinely have been deleted.
    expect(ENDORSEMENTS).toMatch(/catch[\s\S]{0,200}Could not fetch eprint titles/);
  });
});
