/**
 * Unit tests for the durability of ORCID verification.
 *
 * @remarks
 * Verification wrote only `UPDATE authors_index ... WHERE did`. Two ways that
 * lost the result:
 *
 * 1. An author who verified before being indexed matched no rows. The handler
 *    logged that the value would "be picked up when they are indexed" and
 *    discarded it — nothing persisted it, so there was nothing to pick up.
 * 2. `authors_index` is rebuilt from the firehose, and both profile upserts
 *    assigned `orcid = EXCLUDED.orcid`. The next profile update therefore
 *    overwrote a verified ORCID with whatever the PDS record carried, which is
 *    usually null.
 *
 * Verification records something Chive observed — a completed OAuth flow — so
 * it cannot live only in a table reconstructed from someone else's data. These
 * tests assert the write path and both upserts against that.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

const UPSERT_SITES = [
  ['the firehose event processor', 'src/services/indexing/event-processor.ts'],
  ['the PDS scanner', 'src/services/pds-discovery/pds-scanner.ts'],
] as const;

describe('ORCID verification is stored durably', () => {
  const handler = read('src/api/handlers/rest/v1/orcid-auth.ts');

  it('writes to a table that is not rebuilt from the firehose', () => {
    expect(handler).toMatch(/INSERT INTO orcid_verifications/);
  });

  it('still updates the denormalized copy on the author index', () => {
    expect(handler).toMatch(/UPDATE authors_index SET orcid = \$1, orcid_verified_at = NOW\(\)/);
  });

  it('no longer claims an unindexed author will be picked up later', () => {
    expect(handler).not.toMatch(/it will be picked up when they are indexed/i);
  });

  // An ORCID iD identifies one researcher; a second DID claiming a verified one
  // is a conflict to surface, not to store twice.
  it('rejects an ORCID already verified by another account', () => {
    expect(handler).toMatch(/orcid_verifications_orcid_unique/);
    expect(handler).toMatch(/already linked to another account/);
  });
});

describe('profile indexing preserves a verified ORCID', () => {
  it.each(UPSERT_SITES)('%s does not overwrite it on conflict', (_label, path) => {
    expect(read(path)).toMatch(
      /orcid = CASE\s*\n\s*WHEN authors_index\.orcid_verified_at IS NOT NULL THEN authors_index\.orcid/
    );
  });

  it.each(UPSERT_SITES)('%s no longer assigns it straight from the record', (_label, path) => {
    expect(read(path)).not.toMatch(/^\s*orcid = EXCLUDED\.orcid,$/m);
  });

  // Covers the author who verified before ever being indexed: their first row
  // has to pick the verification up rather than start blank.
  it.each(UPSERT_SITES)('%s seeds a new row from the verification table', (_label, path) => {
    expect(read(path)).toMatch(
      /COALESCE\(\(SELECT orcid FROM orcid_verifications WHERE did = \$1\)/
    );
  });
});
