#!/usr/bin/env -S npx tsx

/**
 * Give the graph's unlabelled record nodes their labels.
 *
 * @remarks
 * Two Neo4j writers created a record node with `MERGE (record {uri: $uri})` --
 * no labels, no `subkind`, just the uri. Every other query in the graph selects
 * on `:Node:Object:Eprint` and filters on `subkind`, so those nodes were
 * invisible to all of them: a citation edge whose endpoint was one of them was
 * never written, and no error was raised, because a `MATCH` that matches
 * nothing is not a failure.
 *
 * This labels the nodes already in the graph. The label is taken from the
 * collection in each uri rather than assumed, since a tagged record may be a
 * review as easily as an eprint, and a node labelled as the wrong kind is worse
 * than one left alone: it would start matching queries it has no business
 * answering. A collection with no mapping here is skipped and reported.
 *
 * Idempotent: a node that already carries labels is not considered.
 *
 * Usage: npx tsx scripts/db/label-unlabelled-record-nodes.ts [--dry-run]
 *
 * @packageDocumentation
 */

// The deploy runs this as its own `node dist/...` process, outside the server
// entry points that install the reflect polyfill.
import 'reflect-metadata';

import { Neo4jConnection } from '../../src/storage/neo4j/connection.js';
import { createLogger } from '../../src/observability/logger.js';

/**
 * Labels applied to a record node, by the collection its uri names.
 *
 * @remarks
 * `subkind` is set alongside the labels because the read queries filter on it;
 * a node with the labels but no `subkind` stays invisible to them.
 */
const LABELS_BY_COLLECTION: Record<string, { labels: string; subkind: string }> = {
  'pub.chive.eprint.submission': { labels: 'Node:Object:Eprint', subkind: 'eprint' },
};

/**
 * Extracts the collection from an AT-URI.
 */
function collectionOf(uri: string): string | null {
  const match = /^at:\/\/[^/]+\/([^/]+)\//.exec(uri);
  return match?.[1] ?? null;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const logger = createLogger();

  const connection = new Neo4jConnection();
  await connection.initialize({
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    username: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'password',
  });

  try {
    const found = await connection.executeQuery(
      `MATCH (n) WHERE size(labels(n)) = 0 AND n.uri IS NOT NULL RETURN n.uri AS uri`
    );

    const uris = found.records.map((row) => row.get('uri') as string);
    logger.info('Unlabelled record nodes found', { count: uris.length });

    const byCollection = new Map<string, string[]>();
    const skipped: string[] = [];

    for (const uri of uris) {
      const collection = collectionOf(uri);
      if (!collection || !LABELS_BY_COLLECTION[collection]) {
        skipped.push(uri);
        continue;
      }
      const list = byCollection.get(collection) ?? [];
      list.push(uri);
      byCollection.set(collection, list);
    }

    for (const [collection, collectionUris] of byCollection) {
      const spec = LABELS_BY_COLLECTION[collection];
      if (!spec) continue;

      logger.info('Labelling nodes', {
        collection,
        labels: spec.labels,
        count: collectionUris.length,
        dryRun,
      });

      if (dryRun) continue;

      // The label list cannot be parameterised in Cypher, so it is interpolated
      // -- from this file's own constant, never from the data.
      await connection.executeQuery(
        `UNWIND $uris AS uri
         MATCH (n {uri: uri})
         WHERE size(labels(n)) = 0
         SET n:${spec.labels}, n.subkind = $subkind`,
        { uris: collectionUris, subkind: spec.subkind }
      );
    }

    if (skipped.length > 0) {
      logger.warn('Left unlabelled: no mapping for their collection', {
        count: skipped.length,
        sample: skipped.slice(0, 5),
      });
    }

    logger.info('Labelling complete', {
      labelled: uris.length - skipped.length,
      skipped: skipped.length,
      dryRun,
    });
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error('Labelling failed:', error);
  process.exit(1);
});
