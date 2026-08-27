/**
 * Unit tests for the CID on endorsement views.
 *
 * @remarks
 * Endorsement handlers returned the literal string `'placeholder'` for `cid`,
 * with a comment claiming the CID was not stored in the index. It is: the
 * `endorsements_index` table has had a `cid` column since the initial schema
 * and it is populated at index time. The queries simply never selected it.
 *
 * The lexicon marks `cid` required on the endorsement view because clients use
 * it for optimistic-concurrency writes. A constant string satisfies the type
 * and can never match a real record, so every such write was doomed to fail a
 * comparison it looked like it should pass.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { ReviewService } from '@/services/review/review-service.js';
import type { AtUri } from '@/types/atproto.js';

const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

const EPRINT = 'at://did:plc:izttpdp3l6vss5crelt5kcux/pub.chive.eprint.submission/abc' as AtUri;

describe('endorsement queries select the CID', () => {
  let query: Mock;
  let service: ReviewService;

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    service = new ReviewService({
      pool: { query },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    } as never);
  });

  it('includes cid in the per-eprint listing', async () => {
    await service.getEndorsements(EPRINT);
    expect(query.mock.calls[0]?.[0]).toMatch(/SELECT uri, cid, endorser_did/);
  });

  it('returns the stored cid rather than a constant', async () => {
    query.mockResolvedValue({
      rows: [
        {
          uri: `${EPRINT}/e1`,
          cid: 'bafyreic5ujjnrxvkbxgxfxvmqk3wgkqfxq2zqjr7v6xmzq4kqbxq2zqjr7',
          endorser_did: 'did:plc:izttpdp3l6vss5crelt5kcux',
          eprint_uri: EPRINT,
          contributions: ['methodological'],
          comment: null,
          created_at: new Date('2026-08-25T00:00:00.000Z'),
        },
      ],
      rowCount: 1,
    });

    const endorsements = await service.getEndorsements(EPRINT);

    expect(endorsements[0]?.cid).toBe(
      'bafyreic5ujjnrxvkbxgxfxvmqk3wgkqfxq2zqjr7v6xmzq4kqbxq2zqjr7'
    );
    expect(endorsements[0]?.cid).not.toBe('placeholder');
  });

  // Rows written before the column was populated have no CID; the handlers
  // surface an empty string rather than a value that cannot match.
  it('leaves the cid undefined when the row has none', async () => {
    query.mockResolvedValue({
      rows: [
        {
          uri: `${EPRINT}/e1`,
          cid: null,
          endorser_did: 'did:plc:izttpdp3l6vss5crelt5kcux',
          eprint_uri: EPRINT,
          contributions: [],
          comment: null,
          created_at: new Date('2026-08-25T00:00:00.000Z'),
        },
      ],
      rowCount: 1,
    });

    const endorsements = await service.getEndorsements(EPRINT);
    expect(endorsements[0]?.cid).toBeUndefined();
  });
});

describe('endorsement handlers no longer return a placeholder', () => {
  it.each([
    ['listForUser', 'src/api/handlers/xrpc/endorsement/listForUser.ts'],
    ['listForAuthorPapers', 'src/api/handlers/xrpc/endorsement/listForAuthorPapers.ts'],
  ])('%s returns the record CID', (_label, path) => {
    const contents = read(path);
    expect(contents).toMatch(/cid: item\.cid \?\? ''/);
    expect(contents).not.toMatch(/cid: 'placeholder'/);
  });

  it.each([
    ['listForUser', 'src/api/handlers/xrpc/endorsement/listForUser.ts'],
    ['listForAuthorPapers', 'src/api/handlers/xrpc/endorsement/listForAuthorPapers.ts'],
  ])('%s no longer claims the CID is unstored', (_label, path) => {
    expect(read(path)).not.toMatch(/CID not stored in index/);
  });
});
