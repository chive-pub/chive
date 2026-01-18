#!/usr/bin/env tsx

/**
 * PostgreSQL migration CLI.
 *
 * @remarks
 * Wrapper for node-pg-migrate with environment-aware configuration.
 *
 * Usage:
 * - `pnpm migrate:up` - Run pending migrations
 * - `pnpm migrate:down` - Rollback last migration
 * - `pnpm migrate:create <name>` - Create new migration file
 *
 * @packageDocumentation
 */

import { runner, Migration } from 'node-pg-migrate';
import { getMigrationConfig } from '../../src/storage/postgresql/config.js';

const config = getMigrationConfig();

const direction = process.argv[2] ?? 'up';
const name = process.argv[3];

async function main(): Promise<void> {
  if (direction === 'create') {
    if (!name) {
      console.error('Error: Migration name required');
      console.error('Usage: pnpm migrate:create <name>');
      process.exit(1);
    }

    const migrationPath = await Migration.create(name, config.dir, {
      language: 'ts',
    });
    console.log(`Created migration: ${migrationPath}`);
    return;
  }

  const runnerOptions: Parameters<typeof runner>[0] = {
    databaseUrl: config.databaseUrl,
    dir: config.dir,
    migrationsTable: config.migrationsTable,
    schema: config.schema,
    direction: direction === 'down' ? 'down' : 'up',
    count: direction === 'down' ? 1 : undefined,
    createMigrationsSchema: true,
    log: (msg) => console.log(msg),
  };

  try {
    await runner(runnerOptions);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
