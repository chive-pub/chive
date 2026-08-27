/**
 * Unit tests keeping the indexed-collection lists from drifting apart again.
 *
 * @remarks
 * "The collections we index" was stated in three places that disagreed: the
 * firehose event processor's dispatch, `sync.indexRecord`'s manual reindex
 * list, and the PDS scanner's backfill filter. A collection in one and not
 * another means the index depends on how a record arrived — the live firehose
 * indexes it, a manual reindex rejects it as unsupported, and a backfill skips
 * it without saying so.
 *
 * `sync.indexRecord` accepted 13 while the event processor handled 20, so seven
 * were unreachable by manual reindex — including `pub.chive.graph.edgeProposal`,
 * which meant an edge proposal the firehose missed could not be recovered at
 * all.
 *
 * The event processor is the authoritative definition, because it is the live
 * path. This test reads the `case` labels straight out of its dispatch, so a
 * new branch added there without a matching entry in the shared list fails here
 * rather than quietly recreating the divergence.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import {
  INDEXED_COLLECTIONS,
  isIndexedCollection,
} from '@/services/indexing/indexed-collections.js';

/** Collections the firehose event processor actually dispatches on. */
const dispatchedCollections = (): string[] => {
  const source = readFileSync(
    join(process.cwd(), 'src/services/indexing/event-processor.ts'),
    'utf8'
  );
  const matches = [...source.matchAll(/case '(pub\.chive\.[a-zA-Z.]+)':/g)];
  return [...new Set(matches.map((match) => match[1]!))].sort();
};

describe('INDEXED_COLLECTIONS', () => {
  it('matches what the event processor dispatches on', () => {
    expect([...INDEXED_COLLECTIONS].sort()).toEqual(dispatchedCollections());
  });

  it('is not empty', () => {
    expect(INDEXED_COLLECTIONS.length).toBeGreaterThan(0);
  });

  it('contains no duplicates', () => {
    expect(new Set(INDEXED_COLLECTIONS).size).toBe(INDEXED_COLLECTIONS.length);
  });

  // The specific gap the divergence left: an edge proposal missed by the
  // firehose was unrecoverable, because manual reindex refused the collection.
  it('includes the edge proposal collection that manual reindex rejected', () => {
    expect(isIndexedCollection('pub.chive.graph.edgeProposal')).toBe(true);
  });

  it.each([
    'pub.chive.actor.profile',
    'pub.chive.collaboration.invite',
    'pub.chive.collaboration.inviteAcceptance',
    'pub.chive.eprint.changelog',
    'pub.chive.eprint.version',
  ])('includes %s, previously unreachable by manual reindex', (collection) => {
    expect(isIndexedCollection(collection)).toBe(true);
  });

  it('excludes pub.chive.eprint.tag, for which there is no lexicon', () => {
    // The record type is `pub.chive.eprint.userTag`. Listing the old name here
    // let `sync.indexRecord` accept a manual index request for a collection
    // with no schema to validate the record against.
    expect(isIndexedCollection('pub.chive.eprint.tag')).toBe(false);
  });

  it('rejects a collection outside the namespace', () => {
    expect(isIndexedCollection('app.bsky.feed.post')).toBe(false);
  });
});

describe('sync.indexRecord uses the shared list', () => {
  it('no longer keeps its own copy', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/api/handlers/xrpc/sync/indexRecord.ts'),
      'utf8'
    );
    expect(source).toMatch(/isIndexedCollection\(collection\)/);
    expect(source).not.toMatch(/const supportedCollections = \[/);
  });
});
