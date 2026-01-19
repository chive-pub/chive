#!/usr/bin/env tsx

/**
 * Elasticsearch setup script.
 *
 * @remarks
 * Applies index templates and ILM policies.
 * Includes retry logic for container startup race conditions.
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
    console.log('Setting up Elasticsearch...');
    await waitForElasticsearch(client);
    await setupElasticsearch(client);
    console.log('Elasticsearch setup complete');
  } catch (error) {
    console.error('Elasticsearch setup failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
