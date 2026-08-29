import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { INDEXED_COLLECTIONS } from '@/services/indexing/indexed-collections.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

function recordLexicons(dir: string, out = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) recordLexicons(full, out);
    else if (entry.name.endsWith('.json')) {
      const doc = JSON.parse(readFileSync(full, 'utf8')) as {
        id?: string;
        defs?: Record<string, { type?: string }>;
      };
      if (doc.id && doc.defs?.main?.type === 'record') out.add(doc.id);
    }
  }
  return out;
}

const RECORDS = recordLexicons(join(REPO_ROOT, 'lexicons/pub/chive'));

const scopes = readFileSync(join(REPO_ROOT, 'src/auth/scopes/chive-scopes.ts'), 'utf8');
const GRANTED_WRITES = new Set(
  [...scopes.matchAll(/repo:(pub\.chive\.[a-zA-Z.]+)/g)].map((m) => m[1]!)
);

/**
 * Granted a write scope, given a schema, indexed from the firehose: a
 * collection needs all three, and the three lists were maintained separately.
 * `pub.chive.actor.profileConfig` had a scope and no lexicon (CFG-2);
 * `pub.chive.eprint.tag` was in the indexed set with no lexicon at all, so
 * `sync.indexRecord` accepted manual index requests for a collection that has
 * no schema to validate against.
 */
describe('indexed collections, lexicons and write scopes agree', () => {
  it('reads a non-trivial number of record lexicons', () => {
    expect(RECORDS.size).toBeGreaterThan(15);
    expect(GRANTED_WRITES.size).toBeGreaterThan(15);
  });

  it('every indexed collection has a record lexicon', () => {
    for (const collection of INDEXED_COLLECTIONS) {
      expect(RECORDS, `${collection} is indexed but has no record lexicon`).toContain(collection);
    }
  });

  it('every granted write scope names a record lexicon', () => {
    // A write scope for a collection with no schema means clients can write
    // whatever they like into it and the indexer has nothing to validate.
    for (const scope of GRANTED_WRITES) {
      expect(RECORDS, `${scope} is a granted write scope with no record lexicon`).toContain(scope);
    }
  });

  it('every granted write scope is either indexed or read through from the PDS', () => {
    // Not every granted write scope should be indexed. `discovery.settings` is
    // read on demand straight from the user's PDS
    // (`actor/getDiscoverySettings.ts` issues `com.atproto.repo.getRecord`), so
    // it is deliberately outside the firehose set — a per-user preference does
    // not belong in a shared index.
    //
    // What must not exist is a third category: a collection Chive asks to write
    // and then never sees again. `pub.chive.actor.mute` was exactly that until
    // 0.11.0 — the client read the records straight from the PDS, so muting
    // worked in the interface, while the server had no idea any mute existed
    // and so could not apply one in a feed, a search or a notification.
    const READ_THROUGH = ['pub.chive.discovery.settings'];

    const unconsumed = [...GRANTED_WRITES]
      .filter((s) => !INDEXED_COLLECTIONS.includes(s))
      .filter((s) => !READ_THROUGH.includes(s))
      .sort();

    expect(unconsumed).toEqual([]);
  });
});
