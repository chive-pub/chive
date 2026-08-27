#!/usr/bin/env tsx

/**
 * Recreate Elasticsearch eprints index with current schema.
 *
 * @remarks
 * DESTRUCTIVE. This deletes the index and everything in it, and search is down
 * from the delete until a full repopulation finishes. Prefer
 * `migrateIndexToCurrentMapping` from src/storage/elasticsearch/setup.ts, which
 * applies a changed mapping by building the next index version, copying the
 * documents, and moving the alias atomically — search keeps serving the old
 * index throughout and switches between one request and the next.
 *
 * This script remains for the cases that migration cannot serve: a corrupted
 * index, or a deliberate rebuild from the PDSes rather than from the existing
 * documents.
 *
 * It refuses to run without an explicit confirmation, because it used to delete
 * a live index with no prompt at all.
 *
 * This script:
 * 1. Deletes the existing eprints-v1 index and alias
 * 2. Recreates with the current template
 *
 * After running this, you MUST run reindex-all-eprints.ts to repopulate.
 *
 * @packageDocumentation
 */

import {
  createElasticsearchClient,
  setupElasticsearch,
} from '../../src/storage/elasticsearch/setup.js';

const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForElasticsearch(
  client: ReturnType<typeof createElasticsearchClient>
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const health = await client.cluster.health({ wait_for_status: 'yellow', timeout: '5s' });
      console.log(`Elasticsearch is ready (status: ${health.status})`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Waiting for Elasticsearch... (attempt ${attempt}/${MAX_RETRIES}): ${message}`);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw new Error(`Elasticsearch not available after ${MAX_RETRIES} attempts`);
}

async function main(): Promise<void> {
  const client = createElasticsearchClient();

  try {
    console.log('===========================================');
    console.log('Elasticsearch Index Recreation Script');
    console.log('===========================================');
    console.log();

    await waitForElasticsearch(client);

    // Check if index exists
    const indexName = 'eprints-v1';
    const aliasName = 'eprints';

    const indexExists = await client.indices.exists({ index: indexName });
    if (indexExists) {
      // The index holds every indexed eprint, and search is down from here
      // until a full repopulation completes. That is too much to do because
      // someone ran the wrong script.
      const confirmed =
        process.argv.includes('--force') || process.env.CHIVE_CONFIRM_INDEX_DELETE === 'yes';

      if (!confirmed) {
        console.error(`Refusing to delete the live index ${indexName}.`);
        console.error();
        console.error('This deletes every indexed document and takes search down until a full');
        console.error('repopulation finishes. To apply a mapping change without downtime, use');
        console.error('migrateIndexToCurrentMapping() from src/storage/elasticsearch/setup.ts:');
        console.error('it builds the next index version, copies the documents, and moves the');
        console.error('alias atomically.');
        console.error();
        console.error('If you really do want to delete and rebuild, re-run with --force');
        console.error('(or CHIVE_CONFIRM_INDEX_DELETE=yes), and be ready to run');
        console.error('reindex-all-eprints.ts immediately afterwards.');
        process.exitCode = 1;
        return;
      }

      console.log(`Deleting existing index: ${indexName}`);

      // First remove alias if it exists
      try {
        await client.indices.deleteAlias({ index: indexName, name: aliasName });
        console.log(`  Removed alias: ${aliasName}`);
      } catch {
        // Alias might not exist
      }

      // Delete the index
      await client.indices.delete({ index: indexName });
      console.log(`  Deleted index: ${indexName}`);
    } else {
      console.log(`Index ${indexName} does not exist, will create fresh`);
    }

    console.log();
    console.log('Running full Elasticsearch setup...');
    await setupElasticsearch(client);

    // Verify the field_nodes mapping
    const mapping = await client.indices.getMapping({ index: indexName });
    const fieldNodesMapping =
      (
        mapping[indexName]?.mappings?.properties as Record<
          string,
          { type?: string; properties?: Record<string, unknown> }
        >
      )?.field_nodes ?? null;

    console.log();
    console.log('Verifying field_nodes mapping:');
    if (fieldNodesMapping?.type === 'nested' && fieldNodesMapping?.properties) {
      console.log('  ✓ field_nodes is nested type');
      console.log(
        `  ✓ Properties: ${Object.keys(fieldNodesMapping.properties as Record<string, unknown>).join(', ')}`
      );
    } else {
      console.error('  ✗ field_nodes mapping is incorrect!');
      console.error('  Got:', JSON.stringify(fieldNodesMapping, null, 2));
      process.exit(1);
    }

    console.log();
    console.log('===========================================');
    console.log('Index recreation complete!');
    console.log('===========================================');
    console.log();
    console.log('IMPORTANT: Run reindex-all-eprints.ts to repopulate the index.');
  } catch (error) {
    console.error('Index recreation failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
