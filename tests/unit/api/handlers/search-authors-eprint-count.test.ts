/**
 * Guards the eprint count author autocomplete shows beside each suggestion.
 *
 * @remarks
 * The count used to be built by tallying how often an author appeared in the
 * page of search hits. That number is bounded twice over — the search runs with
 * `limit * 3` hits and the loop stops once `limit` distinct authors are found —
 * so it can never exceed a fraction of a page however prolific the author. It
 * is a different quantity from the one the field names.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const handler = readFileSync(
  join(process.cwd(), 'src/api/handlers/xrpc/author/searchAuthors.ts'),
  'utf8'
);

describe('searchAuthors eprint count', () => {
  it('does not tally appearances in the search page', () => {
    expect(handler).not.toContain('existing.eprintCount += 1');
  });

  it('asks the datastore for the real count', () => {
    expect(handler).toContain('countEprintsByAuthors');
  });

  it('fetches the counts for the whole page in one call', () => {
    // A call per suggestion would be a round trip per keystroke per author,
    // which is the cost the batched record fetch in the same function exists
    // to avoid.
    const calls = handler.match(/countEprintsByAuthors/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it('defaults to zero rather than showing nothing', () => {
    expect(handler).toMatch(/counts\.get\([^)]+\)\s*\?\?\s*0/);
  });
});

describe('batched author count query', () => {
  const repository = readFileSync(
    join(process.cwd(), 'src/storage/postgresql/eprints-repository.ts'),
    'utf8'
  );

  it('counts distinct eprints, not author-array entries', () => {
    // An author listed twice in one eprint's author array would otherwise make
    // that eprint count twice. Verified against Postgres: COUNT(*) reports 2
    // for such a record where COUNT(DISTINCT uri) reports 1.
    expect(repository).toContain('COUNT(DISTINCT uri)');
  });

  it('excludes soft-deleted eprints, as the single-author count does', () => {
    const batched = repository.slice(repository.indexOf('async countByAuthors'));
    expect(batched.slice(0, 1200)).toContain('deleted_at IS NULL');
  });

  it('returns an empty map for no authors without querying', () => {
    const batched = repository.slice(repository.indexOf('async countByAuthors'));
    expect(batched.slice(0, 400)).toContain('authors.length === 0');
  });
});
