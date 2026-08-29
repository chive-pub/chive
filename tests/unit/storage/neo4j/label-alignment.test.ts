/**
 * Unit tests aligning read-side Cypher with the labels the write side creates.
 *
 * @remarks
 * Cypher does not error on a label that matches nothing — it returns no rows.
 * Several recommendation and collaboration queries matched labels and property
 * shapes that no writer in this codebase ever produces, so those features
 * returned empty results indefinitely and looked like "no data yet".
 *
 * Two mismatches existed. Fields are created as `(:Node:Field {uri})` and were
 * read as `(:FieldNode)`. Authors are created as `(:Node:Object:Person)` with
 * `subkind = 'author'` and the DID under `metadata.did` — that is what
 * `AuthorRepository.createCoauthorship` writes `COAUTHORED_WITH` between — and
 * were read as `(:Author {did})`, so collaboration strength was null for every
 * pair of authors who had in fact collaborated.
 *
 * These are asserted against the source because they are query text: there is
 * no behaviour to observe without a live Neo4j, and a live Neo4j would not
 * catch the mismatch either — it would happily return nothing.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const source = (name: string): string =>
  readFileSync(join(process.cwd(), 'src/storage/neo4j', `${name}.ts`), 'utf8');

/**
 * The file with block comments stripped.
 *
 * @remarks
 * The explanatory notes in these files name the old labels in order to explain
 * them, so an assertion that a label is absent has to look at the code rather
 * than at prose describing the code.
 */
const queryText = (name: string): string => source(name).replace(/\/\*[\s\S]*?\*\//g, '');

// `collaboration-graph` was deleted in 0.11.0: it had no importer anywhere, so
// its labels could not be misaligned with anything.
const READ_SIDE = ['recommendations', 'graph-algorithms'] as const;

describe('read queries use labels the write side creates', () => {
  it.each(READ_SIDE)('%s does not match the non-existent :FieldNode label', (name) => {
    expect(queryText(name)).not.toMatch(/:FieldNode/);
  });

  it.each(['recommendations', 'graph-algorithms'] as const)(
    '%s matches fields as :Node:Field',
    (name) => {
      expect(source(name)).toMatch(/:Node:Field/);
    }
  );
});

describe('the missing INTERESTED_IN writer is recorded', () => {
  // Relabelling cannot fix this half: nothing creates the relationship at all,
  // so the queries that depend on it alone stay empty by construction.
  it.each(['recommendations', 'graph-algorithms'] as const)(
    '%s says the relationship has no writer',
    (name) => {
      expect(source(name)).toMatch(/NOTE ON `INTERESTED_IN`/);
    }
  );

  it('has no writer anywhere in the read-side files themselves', () => {
    for (const name of ['recommendations', 'graph-algorithms'] as const) {
      expect(queryText(name)).not.toMatch(/MERGE \([^)]*\)-\[:INTERESTED_IN\]/);
      expect(queryText(name)).not.toMatch(/CREATE \([^)]*\)-\[:INTERESTED_IN\]/);
    }
  });
});
