#!/usr/bin/env tsx

/**
 * Elasticsearch setup script.
 *
 * @remarks
 * Applies index templates and ILM policies.
 *
 * @packageDocumentation
 */

import {
  createElasticsearchClient,
  setupElasticsearch,
} from '../../src/storage/elasticsearch/setup.js';

async function main(): Promise<void> {
  const client = createElasticsearchClient();

  try {
    console.log('Setting up Elasticsearch...');
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
