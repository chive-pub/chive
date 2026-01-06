/**
 * PostgreSQL connection configuration for Chive.
 *
 * @remarks
 * Configuration is environment-aware, loading credentials from environment
 * variables with fallback to defaults for local development.
 *
 * **Production**: Always use environment variables, never commit credentials.
 *
 * @packageDocumentation
 */

import type { PoolConfig } from 'pg';

/**
 * PostgreSQL connection pool configuration.
 *
 * @remarks
 * Uses connection pooling for efficiency. Pool settings are tuned for:
 * - Development: Low connection count (5-10)
 * - Production: Higher connection count (20-50)
 *
 * Connection timeout prevents hung requests.
 *
 * @public
 */
export interface DatabaseConfig extends PoolConfig {
  /**
   * PostgreSQL host.
   *
   * @defaultValue 'localhost'
   */
  host: string;

  /**
   * PostgreSQL port.
   *
   * @defaultValue 5432
   */
  port: number;

  /**
   * Database name.
   *
   * @remarks
   * Convention: `chive_${environment}` (e.g., `chive_test`, `chive_production`)
   */
  database: string;

  /**
   * Database user.
   */
  user: string;

  /**
   * Database password.
   *
   * @remarks
   * **NEVER commit passwords**. Use environment variables.
   */
  password: string;

  /**
   * Maximum number of connections in pool.
   *
   * @defaultValue 10 (development), 20 (production)
   */
  max?: number;

  /**
   * Connection timeout in milliseconds.
   *
   * @defaultValue 30000 (30 seconds)
   */
  connectionTimeoutMillis?: number;

  /**
   * Idle timeout in milliseconds.
   *
   * @defaultValue 10000 (10 seconds)
   */
  idleTimeoutMillis?: number;
}

/**
 * Loads database configuration from environment variables.
 *
 * @returns Database configuration for connection pool
 *
 * @remarks
 * Environment variables:
 * - `POSTGRES_HOST` - Database host (default: localhost)
 * - `POSTGRES_PORT` - Database port (default: 5432)
 * - `POSTGRES_DB` - Database name (default: chive)
 * - `POSTGRES_USER` - Database user (default: chive)
 * - `POSTGRES_PASSWORD` - Database password (default: chive_local_password)
 * - `POSTGRES_MAX_CONNECTIONS` - Max pool size (default: 10)
 *
 * @example
 * ```typescript
 * import { getDatabaseConfig } from './config.js';
 * import { Pool } from 'pg';
 *
 * const config = getDatabaseConfig();
 * const pool = new Pool(config);
 *
 * const client = await pool.connect();
 * try {
 *   const res = await client.query('SELECT NOW()');
 *   console.log(res.rows[0]);
 * } finally {
 *   client.release();
 * }
 * ```
 *
 * @public
 */
export function getDatabaseConfig(): DatabaseConfig {
  // Default to local development credentials (docker-compose.local.yml)
  // Test environment should set POSTGRES_PASSWORD=chive_test_password explicitly
  return {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    database: process.env.POSTGRES_DB ?? 'chive',
    user: process.env.POSTGRES_USER ?? 'chive',
    password: process.env.POSTGRES_PASSWORD ?? 'chive_local_password',
    max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS ?? '10', 10),
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 10000,
  };
}

/**
 * Migration configuration for node-pg-migrate.
 *
 * @remarks
 * Migration settings:
 * - Migrations stored in `src/storage/postgresql/migrations/`
 * - Migration table: `pgmigrations`
 * - Schema: `public`
 *
 * @public
 */
export interface MigrationConfig {
  /**
   * Database connection string.
   *
   * @remarks
   * Format: `postgresql://user:password@host:port/database`
   */
  databaseUrl: string;

  /**
   * Directory containing migration files.
   */
  dir: string;

  /**
   * Migration table name.
   *
   * @defaultValue 'pgmigrations'
   */
  migrationsTable: string;

  /**
   * Schema for migration table.
   *
   * @defaultValue 'public'
   */
  schema: string;
}

/**
 * Loads migration configuration from environment.
 *
 * @returns Migration configuration for node-pg-migrate
 *
 * @remarks
 * Uses same database connection as app, but with dedicated migration table.
 *
 * @example
 * ```typescript
 * import { getMigrationConfig } from './config.js';
 * import runner from 'node-pg-migrate';
 *
 * const config = getMigrationConfig();
 * await runner({
 *   databaseUrl: config.databaseUrl,
 *   dir: config.dir,
 *   direction: 'up',
 *   migrationsTable: config.migrationsTable,
 * });
 * ```
 *
 * @public
 */
export function getMigrationConfig(): MigrationConfig {
  const dbConfig = getDatabaseConfig();

  return {
    databaseUrl: `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
    dir: 'src/storage/postgresql/migrations',
    migrationsTable: 'pgmigrations',
    schema: 'public',
  };
}
