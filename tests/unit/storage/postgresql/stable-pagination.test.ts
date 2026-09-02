/**
 * Guards that paginated eprint queries have a total order.
 *
 * @remarks
 * `ORDER BY created_at DESC` alone is a partial order. PostgreSQL gives no
 * guarantee about how tied rows are arranged, and it is free to arrange them
 * differently for each query — a different plan, a parallel scan or an
 * intervening write is enough. Every page of a paginated list is a separate
 * query, so tied rows could appear twice, vanish, or land in an order that
 * reads as unsorted.
 *
 * Ties are the norm rather than an edge case here: publication dates are
 * routinely recorded as a month or a year. On one production profile, 23 of 58
 * eprints share a timestamp with another.
 *
 * `uri` is the primary key, so ordering by it after the sort column makes the
 * order total and identical across queries.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repository = readFileSync(
  join(process.cwd(), 'src/storage/postgresql/eprints-repository.ts'),
  'utf8'
);

describe('paginated eprint queries order deterministically', () => {
  it('breaks ties on the primary key when listing an author', () => {
    expect(repository).toContain('ORDER BY ${sortColumn} ${sortDirection}, uri ASC');
  });

  it('breaks ties when listing by field', () => {
    expect(repository).toContain('ORDER BY created_at DESC, uri ASC');
  });

  it('leaves no LIMIT/OFFSET query ordered by a non-unique column alone', () => {
    // Any ORDER BY that feeds a paged query needs the tiebreaker; this catches
    // a new one added without it.
    const paged = repository.match(/ORDER BY [^\n]*\n\s*LIMIT[^\n]*OFFSET/g) ?? [];
    for (const clause of paged) {
      expect(clause).toContain('uri ASC');
    }
  });
});
