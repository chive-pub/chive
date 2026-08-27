import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REFERENCE = join(REPO_ROOT, 'docs/reference/lexicons.md');

interface LexiconDoc {
  id?: string;
  defs?: Record<string, { type?: string }>;
}

function lexiconDocs(dir: string, out: LexiconDoc[] = []): LexiconDoc[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) lexiconDocs(full, out);
    else if (entry.name.endsWith('.json')) {
      out.push(JSON.parse(readFileSync(full, 'utf8')) as LexiconDoc);
    }
  }
  return out;
}

const docs = lexiconDocs(join(REPO_ROOT, 'lexicons/pub/chive'));
const reference = readFileSync(REFERENCE, 'utf8');

function countOf(type: string): number {
  return docs.filter((d) => d.defs?.main?.type === type).length;
}

/**
 * `docs/reference/lexicons.md` is written prose, not generated, so it cannot be
 * regenerated and diffed the way the OpenAPI specification now is. What can be
 * checked is that the inventory it asserts still matches the repository: it
 * claimed "17 record types, 81 queries, and 32 procedures" while the repository
 * held 23, 126 and 49 — numbers a reader has no reason to doubt and no way to
 * verify.
 */
describe('the lexicon reference describes the lexicons that exist', () => {
  it('reads a non-trivial number of lexicons', () => {
    expect(docs.length).toBeGreaterThan(100);
  });

  it('states the record, query and procedure counts correctly', () => {
    const stated = /defines? (\d+) record types?, (\d+) queries, and (\d+) procedures/.exec(
      reference
    );
    expect(stated, 'the reference no longer states its counts in the expected form').not.toBeNull();

    expect(Number(stated?.[1]), 'record types').toBe(countOf('record'));
    expect(Number(stated?.[2]), 'queries').toBe(countOf('query'));
    expect(Number(stated?.[3]), 'procedures').toBe(countOf('procedure'));
  });

  it('lists every namespace that exists', () => {
    const namespaces = new Set(
      docs
        .map((d) => d.id)
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.split('.').slice(0, 3).join('.'))
    );

    for (const ns of namespaces) {
      expect(reference, `${ns} is missing from the namespace table`).toContain(ns);
    }
  });

  it('states the namespace count correctly', () => {
    const namespaces = new Set(
      docs
        .map((d) => d.id)
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.split('.').slice(0, 3).join('.'))
    );

    const stated = /across (\d+) namespaces/.exec(reference);
    expect(stated).not.toBeNull();
    expect(Number(stated?.[1])).toBe(namespaces.size);
  });
});
