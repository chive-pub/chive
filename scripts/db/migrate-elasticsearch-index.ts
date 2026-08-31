#!/usr/bin/env tsx

/**
 * Apply the current Elasticsearch template to the live eprints index.
 *
 * @remarks
 * Elasticsearch mappings are fixed once an index exists, so editing
 * `src/storage/elasticsearch/templates/eprints.json` does not change a running
 * deployment. This runs {@link migrateIndexToCurrentMapping}: it creates the
 * next index version from the current template, copies the documents across,
 * and moves the `eprints` alias in one atomic action. Search serves the old
 * index for the whole reindex and switches between one request and the next.
 *
 * The previous index is kept unless `--delete-previous` is passed. It is the
 * only copy of the pre-migration state, and keeping it makes the migration
 * reversible by moving the alias back.
 *
 * This copies documents from the existing index rather than refetching from
 * PDSes, so it applies mapping and analyzer changes but does not repair
 * documents that were indexed wrongly. Use `reindex-all-eprints.ts` for that.
 *
 * Usage: npx tsx scripts/db/migrate-elasticsearch-index.ts [--delete-previous]
 *
 * @packageDocumentation
 */

import {
  createElasticsearchClient,
  setupElasticsearch,
  migrateIndexToCurrentMapping,
} from '../../src/storage/elasticsearch/setup.js';

async function main(): Promise<void> {
  const deletePrevious = process.argv.includes('--delete-previous');
  const client = createElasticsearchClient();

  try {
    // Push the current template first: the new index is built from whatever the
    // cluster's template says, not from the file, so a stale template would be
    // faithfully reapplied and the migration would change nothing.
    await setupElasticsearch(client);

    const result = await migrateIndexToCurrentMapping(client, { deletePrevious });

    console.log(`Alias 'eprints' moved from ${result.from} to ${result.to}`);
    console.log(`Documents copied: ${result.documentsReindexed}`);
    console.log(
      result.previousIndexDeleted
        ? `Previous index ${result.from} deleted`
        : `Previous index ${result.from} kept; delete it once ${result.to} looks right:\n` +
            `  curl -X DELETE "$ELASTICSEARCH_URL/${result.from}"`
    );
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
