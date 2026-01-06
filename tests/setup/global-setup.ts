/**
 * Global test setup for Vitest.
 *
 * @remarks
 * Runs once before all tests:
 * - Database migrations
 * - Elasticsearch setup
 * - Neo4j schema setup
 *
 * This ensures infrastructure is ready before any test runs,
 * avoiding race conditions from parallel test execution.
 *
 * @packageDocumentation
 */

/* eslint-disable no-console */

import { runner } from 'node-pg-migrate';

import {
  createElasticsearchClient,
  setupElasticsearch,
} from '../../src/storage/elasticsearch/setup.js';
import { createNeo4jDriver, setupNeo4j } from '../../src/storage/neo4j/setup.js';
import { getMigrationConfig } from '../../src/storage/postgresql/config.js';

/**
 * Global setup function.
 *
 * @remarks
 * Runs database migrations and schema setup once before all tests.
 */
export default async function setup(): Promise<void> {
  console.log('🔧 Running global test setup...');

  // PostgreSQL migrations
  try {
    const migrationConfig = getMigrationConfig();
    await runner({
      databaseUrl: migrationConfig.databaseUrl,
      dir: migrationConfig.dir,
      direction: 'up',
      migrationsTable: migrationConfig.migrationsTable,
      createMigrationsSchema: true,
      log: () => {
        // Suppress migration logs
      },
    });
    console.log('✓ PostgreSQL migrations complete');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Another migration is already running')) {
      console.log('✓ PostgreSQL migrations already running or complete');
    } else {
      throw error;
    }
  }

  // Elasticsearch setup
  try {
    const esClient = createElasticsearchClient();
    await setupElasticsearch(esClient);
    await esClient.close();
    console.log('✓ Elasticsearch setup complete');
  } catch (error) {
    console.warn('⚠ Elasticsearch setup failed (may not be running):', error);
  }

  // Neo4j setup
  try {
    const neo4jDriver = createNeo4jDriver();
    await setupNeo4j(neo4jDriver);
    await neo4jDriver.close();
    console.log('✓ Neo4j setup complete');
  } catch (error) {
    console.warn('⚠ Neo4j setup failed (may not be running):', error);
  }

  console.log('✅ Global test setup complete\n');
}
