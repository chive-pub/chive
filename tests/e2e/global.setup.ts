/**
 * Playwright global setup - runs migrations and seeds test data before tests run.
 *
 * @see https://playwright.dev/docs/test-global-setup-teardown
 */

import { runner } from 'node-pg-migrate';
import path from 'path';

import { seedPostgres, seedElasticsearch, seedNeo4j } from '../../scripts/seed-test-data.js';

const POSTGRES_URL =
  process.env.DATABASE_URL ?? 'postgresql://chive:chive_test_password@127.0.0.1:5432/chive';

/**
 * Runs PostgreSQL migrations.
 */
async function runMigrations(): Promise<void> {
  try {
    await runner({
      databaseUrl: POSTGRES_URL,
      dir: path.resolve(import.meta.dirname, '../../src/storage/postgresql/migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      createMigrationsSchema: true,
      log: () => {
        // Suppress migration logs
      },
    });
    console.log('  PostgreSQL: Migrations complete');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Another migration is already running')) {
      console.log('  PostgreSQL: Migrations already running or complete');
    } else {
      throw error;
    }
  }
}

/**
 * Global setup function - runs once before all tests.
 */
async function globalSetup(): Promise<void> {
  console.log('\n🔧 Running E2E test setup...\n');

  // Run migrations first to ensure schema exists
  await runMigrations();

  console.log('\n🌱 Seeding test data...\n');

  await seedPostgres();
  await seedElasticsearch();
  await seedNeo4j();

  console.log('\n✅ E2E test setup complete\n');
}

export default globalSetup;
