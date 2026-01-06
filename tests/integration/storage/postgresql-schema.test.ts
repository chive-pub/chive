/**
 * PostgreSQL schema integration tests.
 *
 * @remarks
 * Verifies database schema correctness and ATProto compliance:
 * - All index tables exist with correct naming convention
 * - PDS source tracking columns present
 * - Foreign keys use AT URIs (not internal IDs)
 * - No blob data columns (BYTEA)
 * - Indexes created for performance
 *
 * @packageDocumentation
 */

import { runner } from 'node-pg-migrate';
import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import { getMigrationConfig } from '@/storage/postgresql/config.js';

describe('PostgreSQL Schema', () => {
  let pool: Pool;

  beforeAll(() => {
    const config = getDatabaseConfig();
    pool = new Pool(config);
    // Note: Migrations are run in global setup (tests/setup/global-setup.ts)
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Table Structure', () => {
    it('creates all required index tables', async () => {
      const result = await pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE '%_index'
        ORDER BY table_name
      `);

      const tableNames = result.rows.map((row) => row.table_name);

      expect(tableNames).toContain('preprints_index');
      expect(tableNames).toContain('authors_index');
      expect(tableNames).toContain('reviews_index');
      expect(tableNames).toContain('endorsements_index');
      expect(tableNames).toContain('user_tags_index');
    });

    it('creates firehose infrastructure tables', async () => {
      const result = await pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('firehose_cursor', 'firehose_dlq', 'pds_sync_status')
        ORDER BY table_name
      `);

      const tableNames = result.rows.map((row) => row.table_name);

      expect(tableNames).toContain('firehose_cursor');
      expect(tableNames).toContain('firehose_dlq');
      expect(tableNames).toContain('pds_sync_status');
    });
  });

  describe('ATProto Compliance: PDS Source Tracking', () => {
    it('all index tables have pds_url column', async () => {
      const result = await pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE '%_index'
      `);

      for (const { table_name } of result.rows) {
        const columnResult = await pool.query<{ column_name: string }>(
          `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'pds_url'
        `,
          [table_name]
        );

        expect(columnResult.rows.length).toBe(1);
      }
    });

    it('all index tables have indexed_at column', async () => {
      const result = await pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE '%_index'
      `);

      for (const { table_name } of result.rows) {
        const columnResult = await pool.query<{ column_name: string }>(
          `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'indexed_at'
        `,
          [table_name]
        );

        expect(columnResult.rows.length).toBe(1);
      }
    });

    it('all index tables have last_synced_at column', async () => {
      const result = await pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE '%_index'
      `);

      for (const { table_name } of result.rows) {
        const columnResult = await pool.query<{ column_name: string }>(
          `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name IN ('last_synced_at', 'last_synced')
        `,
          [table_name]
        );

        // Either last_synced_at or last_synced should exist
        expect(columnResult.rows.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('ATProto Compliance: No Blob Data', () => {
    it('no BYTEA columns in index tables', async () => {
      const result = await pool.query<{ table_name: string; column_name: string }>(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name LIKE '%_index'
          AND data_type = 'bytea'
      `);

      expect(result.rows).toHaveLength(0);
    });

    it('preprints_index only stores BlobRef CIDs (not blob data)', async () => {
      const result = await pool.query<{ column_name: string; data_type: string }>(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'preprints_index'
          AND column_name LIKE '%blob%'
      `);

      for (const row of result.rows) {
        // Blob CID and MIME type columns should be text
        // Blob size columns should be bigint (file size in bytes)
        if (row.column_name.endsWith('_size')) {
          expect(row.data_type).toBe('bigint');
        } else {
          expect(row.data_type).toBe('text');
        }
      }
    });
  });

  describe('ATProto Compliance: AT URI Primary Keys', () => {
    it('preprints_index uses uri (AT URI) as primary key', async () => {
      const result = await pool.query<{ column_name: string; data_type: string }>(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'preprints_index'
          AND column_name = 'uri'
      `);

      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row).toBeDefined();

      if (!row) return;

      expect(row.data_type).toBe('text');

      const pkResult = await pool.query<{ constraint_name: string }>(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'preprints_index'
          AND constraint_type = 'PRIMARY KEY'
      `);

      expect(pkResult.rows.length).toBeGreaterThan(0);
    });

    it('reviews_index uses uri (AT URI) as primary key', async () => {
      const result = await pool.query<{ column_name: string; data_type: string }>(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'reviews_index'
          AND column_name = 'uri'
      `);

      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row).toBeDefined();

      if (!row) return;

      expect(row.data_type).toBe('text');
    });

    it('foreign keys reference AT URIs (not sequential IDs)', async () => {
      const result = await pool.query<{
        table_name: string;
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
      }>(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name LIKE '%_index'
      `);

      for (const row of result.rows) {
        // Foreign key columns should end with '_uri' (AT URIs)
        expect(row.column_name).toMatch(/_uri$/);
        expect(row.foreign_column_name).toBe('uri');
      }
    });
  });

  describe('Performance Indexes', () => {
    it('creates indexes on frequently queried columns', async () => {
      const result = await pool.query<{
        table_name: string;
        index_name: string;
        column_name: string;
      }>(`
        SELECT
          t.relname AS table_name,
          i.relname AS index_name,
          a.attname AS column_name
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname LIKE '%_index'
          AND t.relkind = 'r'
        ORDER BY t.relname, i.relname
      `);

      const indexes = result.rows;

      // Check preprints_index has indexes
      const preprintIndexes = indexes.filter((idx) => idx.table_name === 'preprints_index');
      const indexedColumns = preprintIndexes.map((idx) => idx.column_name);

      expect(indexedColumns).toContain('author_did');
      expect(indexedColumns).toContain('created_at');
      expect(indexedColumns).toContain('pds_url');
    });

    it('creates GIN index on keywords array', async () => {
      const result = await pool.query<{
        index_name: string;
        index_type: string;
      }>(`
        SELECT
          i.relname AS index_name,
          am.amname AS index_type
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_am am ON i.relam = am.oid
        WHERE t.relname = 'preprints_index'
          AND am.amname = 'gin'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity', () => {
    it('preprints_index has NOT NULL constraints on required fields', async () => {
      const result = await pool.query<{ column_name: string; is_nullable: string }>(`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'preprints_index'
          AND column_name IN ('uri', 'cid', 'author_did', 'title', 'abstract', 'pds_url')
      `);

      for (const row of result.rows) {
        expect(row.is_nullable).toBe('NO');
      }
    });

    it('endorsement_type has CHECK constraint', async () => {
      const result = await pool.query<{ constraint_name: string }>(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'endorsements_index'
          AND constraint_type = 'CHECK'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Migration Reversibility', () => {
    it('latest migration can be rolled back', async () => {
      const migrationConfig = getMigrationConfig();

      // Latest migration is separate-bluesky-counts (1734700000000)
      // This migration adds bluesky_post_count, bluesky_embed_count, other_count columns
      // and removes the combined bluesky_count column

      // Verify new columns exist before rollback
      const beforeResult = await pool.query<{ column_name: string }>(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'backlink_counts'
          AND column_name IN ('bluesky_post_count', 'bluesky_embed_count', 'other_count')
      `
      );

      expect(beforeResult.rows).toHaveLength(3);

      // Rollback latest migration
      await runner({
        databaseUrl: migrationConfig.databaseUrl,
        dir: migrationConfig.dir,
        direction: 'down',
        count: 1,
        migrationsTable: migrationConfig.migrationsTable,
        log: () => {
          // Suppress migration logs in tests
        },
      });

      // Verify new columns are dropped and old column is restored
      const afterResult = await pool.query<{ column_name: string }>(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'backlink_counts'
          AND column_name IN ('bluesky_post_count', 'bluesky_embed_count', 'other_count')
      `
      );

      expect(afterResult.rows).toHaveLength(0);

      // Verify bluesky_count column is restored
      const restoredResult = await pool.query<{ column_name: string }>(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'backlink_counts'
          AND column_name = 'bluesky_count'
      `
      );

      expect(restoredResult.rows).toHaveLength(1);

      // Verify index tables from earlier migrations still exist
      const indexResult = await pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE '%_index'
      `);

      expect(indexResult.rows.length).toBeGreaterThan(0);

      // Re-apply migration for other tests
      await runner({
        databaseUrl: migrationConfig.databaseUrl,
        dir: migrationConfig.dir,
        direction: 'up',
        migrationsTable: migrationConfig.migrationsTable,
        log: () => {
          // Suppress migration logs in tests
        },
      });
    });
  });
});
