/**
 * ATProto compliance tests for database schemas.
 *
 * @remarks
 * CRITICAL tests verifying ATProto specification compliance:
 * - Index semantics (not source of truth)
 * - PDS source tracking
 * - No blob data storage
 * - Rebuilding from firehose
 * - AT URI references
 *
 * **All tests must pass 100% before production.**
 *
 * @packageDocumentation
 */

import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { getDatabaseConfig } from '../../src/storage/postgresql/config.js';

describe('ATProto Database Compliance', () => {
  let pool: Pool;

  beforeAll(() => {
    const config = getDatabaseConfig();
    pool = new Pool(config);
    // Note: Migrations are run in global setup (tests/setup/global-setup.ts)
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('CRITICAL: Index Semantics', () => {
    it('all user data tables use _index naming convention', async () => {
      const result = await pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'eprints_index',
            'authors_index',
            'reviews_index',
            'endorsements_index',
            'user_tags_index'
          )
      `);

      // All 5 tables must exist
      expect(result.rows).toHaveLength(5);

      // All must end with _index
      for (const row of result.rows) {
        expect(row.table_name).toMatch(/_index$/);
      }
    });

    it('infrastructure tables do NOT use _index suffix', async () => {
      const result = await pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('firehose_cursor', 'firehose_dlq', 'pds_sync_status')
      `);

      // These tables are infrastructure, not user data indexes
      for (const row of result.rows) {
        expect(row.table_name).not.toMatch(/_index$/);
      }
    });
  });

  describe('CRITICAL: PDS Source Tracking', () => {
    it('all index tables track PDS URL', async () => {
      const indexTables = [
        'eprints_index',
        'authors_index',
        'reviews_index',
        'endorsements_index',
        'user_tags_index',
      ];

      for (const tableName of indexTables) {
        const result = await pool.query<{
          column_name: string;
          is_nullable: string;
        }>(
          `
          SELECT column_name, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'pds_url'
        `,
          [tableName]
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toBeDefined();
        expect(result.rows[0]?.is_nullable).toBe('NO'); // Must be NOT NULL
      }
    });

    it('all index tables track indexed_at timestamp', async () => {
      const indexTables = [
        'eprints_index',
        'authors_index',
        'reviews_index',
        'endorsements_index',
        'user_tags_index',
      ];

      for (const tableName of indexTables) {
        const result = await pool.query<{
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>(
          `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'indexed_at'
        `,
          [tableName]
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toBeDefined();
        expect(result.rows[0]?.data_type).toBe('timestamp with time zone');
        expect(result.rows[0]?.is_nullable).toBe('NO');
      }
    });

    it('pds_sync_status table tracks sync status per PDS', async () => {
      const result = await pool.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pds_sync_status'
        ORDER BY column_name
      `);

      const columns = result.rows.map((row) => row.column_name);

      expect(columns).toContain('pds_url');
      expect(columns).toContain('last_synced');
      expect(columns).toContain('last_error');
      expect(columns).toContain('error_count');
      expect(columns).toContain('is_healthy');
    });
  });

  describe('CRITICAL: No Blob Data Storage', () => {
    it('NO BYTEA columns in any index table', async () => {
      const result = await pool.query<{
        table_name: string;
        column_name: string;
        data_type: string;
      }>(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name LIKE '%_index'
          AND data_type = 'bytea'
      `);

      expect(result.rows).toHaveLength(0);
    });

    it('eprints_index stores BlobRef CIDs only', async () => {
      const result = await pool.query<{
        column_name: string;
        data_type: string;
      }>(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'eprints_index'
          AND column_name IN ('document_blob_cid', 'document_blob_mime_type', 'document_blob_size')
      `);

      expect(result.rows).toHaveLength(3);

      // All blob-related columns must be metadata (text/bigint), NOT blob data
      for (const row of result.rows) {
        expect(['text', 'bigint']).toContain(row.data_type);
        expect(row.data_type).not.toBe('bytea');
      }
    });

    it('authors_index stores avatar BlobRef CID only', async () => {
      const result = await pool.query<{
        column_name: string;
        data_type: string;
      }>(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'authors_index'
          AND column_name = 'avatar_blob_cid'
      `);

      if (result.rows.length > 0) {
        expect(result.rows[0]).toBeDefined();
        expect(result.rows[0]?.data_type).toBe('text');
        expect(result.rows[0]?.data_type).not.toBe('bytea');
      }
    });
  });

  describe('CRITICAL: AT URI References', () => {
    it('all index tables use AT URI as primary key', async () => {
      const indexTables = [
        'eprints_index',
        'reviews_index',
        'endorsements_index',
        'user_tags_index',
      ];

      for (const tableName of indexTables) {
        const result = await pool.query<{
          column_name: string;
          data_type: string;
        }>(
          `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'uri'
        `,
          [tableName]
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toBeDefined();
        expect(result.rows[0]?.data_type).toBe('text');
      }
    });

    it('foreign keys reference AT URIs (not sequential IDs)', async () => {
      const result = await pool.query<{
        table_name: string;
        column_name: string;
        foreign_column_name: string;
      }>(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name LIKE '%_index'
      `);

      for (const row of result.rows) {
        // All foreign keys must reference uri columns (AT URIs)
        expect(row.column_name).toMatch(/_uri$/);
        expect(row.foreign_column_name).toBe('uri');
      }
    });

    it('NO auto-incrementing ID columns as primary keys', async () => {
      const indexTables = [
        'eprints_index',
        'authors_index',
        'reviews_index',
        'endorsements_index',
        'user_tags_index',
      ];

      for (const tableName of indexTables) {
        const result = await pool.query<{ column_name: string }>(
          `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'id'
            AND column_default LIKE 'nextval%'
        `,
          [tableName]
        );

        // No auto-incrementing ID columns
        expect(result.rows).toHaveLength(0);
      }
    });
  });

  describe('CRITICAL: Rebuilding from Firehose', () => {
    it('firehose_cursor table tracks sequence position', async () => {
      const result = await pool.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'firehose_cursor'
        ORDER BY column_name
      `);

      const columns = result.rows.map((row) => row.column_name);

      expect(columns).toContain('service_name');
      expect(columns).toContain('cursor_seq');
      expect(columns).toContain('last_updated');
    });

    it('firehose_dlq table stores failed events for retry', async () => {
      const result = await pool.query<{
        column_name: string;
        data_type: string;
      }>(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'firehose_dlq'
          AND column_name = 'event_data'
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toBeDefined();
      expect(result.rows[0]?.data_type).toBe('jsonb');
    });

    it('all indexed records can be deleted for full rebuild', async () => {
      // Verify CASCADE delete works (simulates full rebuild)
      const result = await pool.query<{
        constraint_name: string;
        table_name: string;
        delete_rule: string;
      }>(`
        SELECT
          tc.constraint_name,
          tc.table_name,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name LIKE '%_index'
      `);

      // All foreign keys should CASCADE on delete (enables full rebuild)
      for (const row of result.rows) {
        expect(['CASCADE', 'SET NULL']).toContain(row.delete_rule);
      }
    });
  });

  describe('Storage Layer Implementation', () => {
    it('connection pool supports health checking', async () => {
      const result = await pool.query<{ health: number }>('SELECT 1 as health');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.health).toBe(1);
    });

    it('transaction support with proper isolation levels', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        const result = await client.query<{ isolation: string }>(
          'SELECT current_setting($1) as isolation',
          ['transaction_isolation']
        );
        expect(result.rows[0]?.isolation).toBeDefined();
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('eprints_index supports UPSERT operations', async () => {
      const testUri = 'at://did:plc:test/pub.chive.eprint.submission/test-upsert';
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `
          INSERT INTO eprints_index (
            uri, cid, submitted_by, authors, title, abstract, abstract_plain_text,
            document_blob_cid, document_blob_mime_type, document_blob_size,
            document_format, publication_status, pds_url, indexed_at, created_at, license
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14)
          ON CONFLICT (uri) DO UPDATE SET
            title = EXCLUDED.title
        `,
          [
            testUri,
            'bafytest',
            'did:plc:test',
            JSON.stringify([
              {
                did: 'did:plc:test',
                name: 'Test Author',
                order: 1,
                affiliations: [],
                contributions: [],
              },
            ]),
            'Test Upsert',
            JSON.stringify({
              type: 'RichText',
              items: [{ type: 'text', content: 'Abstract' }],
              format: 'application/x-chive-gloss+json',
            }),
            'Abstract',
            'bafyblob',
            'application/pdf',
            1024,
            'pdf',
            'eprint',
            'https://pds.test',
            'CC-BY-4.0',
          ]
        );

        const result = await client.query<{ title: string }>(
          'SELECT title FROM eprints_index WHERE uri = $1',
          [testUri]
        );

        expect(result.rows[0]?.title).toBe('Test Upsert');

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('indexes exist for query performance', async () => {
      const requiredIndexes = [
        { table: 'eprints_index', column: 'submitted_by' },
        { table: 'eprints_index', column: 'created_at' },
        { table: 'eprints_index', column: 'pds_url' },
        { table: 'reviews_index', column: 'eprint_uri' },
        { table: 'reviews_index', column: 'reviewer_did' },
      ];

      for (const { table, column } of requiredIndexes) {
        const result = await pool.query<{ indexname: string }>(
          `
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = $1
            AND indexdef LIKE $2
        `,
          [table, `%${column}%`]
        );

        expect(result.rows.length).toBeGreaterThan(0);
      }
    });

    it('batch operations can insert multiple records', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const values = Array.from({ length: 3 }, (_, i) => [
          `at://did:plc:test/pub.chive.eprint.submission/batch-${i}`,
          'bafytest',
          'did:plc:test',
          JSON.stringify([
            {
              did: 'did:plc:test',
              name: 'Test Author',
              order: 1,
              affiliations: [],
              contributions: [],
            },
          ]),
          `Batch Test ${i}`,
          JSON.stringify({
            type: 'RichText',
            items: [{ type: 'text', content: 'Abstract' }],
            format: 'application/x-chive-gloss+json',
          }),
          'Abstract',
          'bafyblob',
          'application/pdf',
          1024,
          'pdf',
          'eprint',
          'https://pds.test',
          'CC-BY-4.0',
        ]);

        const placeholders = values
          .map(
            (_, i) =>
              `($${i * 14 + 1}, $${i * 14 + 2}, $${i * 14 + 3}, $${i * 14 + 4}, $${i * 14 + 5}, $${i * 14 + 6}, $${i * 14 + 7}, $${i * 14 + 8}, $${i * 14 + 9}, $${i * 14 + 10}, $${i * 14 + 11}, $${i * 14 + 12}, $${i * 14 + 13}, NOW(), NOW(), $${i * 14 + 14})`
          )
          .join(', ');

        await client.query(
          `
          INSERT INTO eprints_index (
            uri, cid, submitted_by, authors, title, abstract, abstract_plain_text,
            document_blob_cid, document_blob_mime_type, document_blob_size,
            document_format, publication_status, pds_url, indexed_at, created_at, license
          ) VALUES ${placeholders}
          ON CONFLICT (uri) DO NOTHING
        `,
          values.flat()
        );

        const result = await client.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM eprints_index WHERE uri LIKE 'at://did:plc:test/pub.chive.eprint.submission/batch-%'`
        );

        const count = parseInt(result.rows[0]?.count ?? '0', 10);
        expect(count).toBeGreaterThanOrEqual(3);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('PDS tracking updates work correctly', async () => {
      const testUri = 'at://did:plc:test/pub.chive.eprint.submission/test-pds-tracking';
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `
          INSERT INTO eprints_index (
            uri, cid, submitted_by, authors, title, abstract, abstract_plain_text,
            document_blob_cid, document_blob_mime_type, document_blob_size,
            document_format, publication_status, pds_url, indexed_at, created_at, license
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14)
          ON CONFLICT (uri) DO NOTHING
        `,
          [
            testUri,
            'bafytest',
            'did:plc:test',
            JSON.stringify([
              {
                did: 'did:plc:test',
                name: 'Test Author',
                order: 1,
                affiliations: [],
                contributions: [],
              },
            ]),
            'PDS Tracking Test',
            JSON.stringify({
              type: 'RichText',
              items: [{ type: 'text', content: 'Abstract' }],
              format: 'application/x-chive-gloss+json',
            }),
            'Abstract',
            'bafyblob',
            'application/pdf',
            1024,
            'pdf',
            'eprint',
            'https://old-pds.test',
            'CC-BY-4.0',
          ]
        );

        await client.query(
          `UPDATE eprints_index SET pds_url = $2, indexed_at = NOW() WHERE uri = $1`,
          [testUri, 'https://new-pds.test']
        );

        const result = await client.query<{ pds_url: string }>(
          'SELECT pds_url FROM eprints_index WHERE uri = $1',
          [testUri]
        );

        expect(result.rows[0]?.pds_url).toBe('https://new-pds.test');

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  describe('Compliance Summary', () => {
    it('100% compliance with ATProto AppView requirements', async () => {
      const checks = [
        {
          name: 'Index semantics (_index naming)',
          query: `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%_index'`,
          expected: 8,
        },
        {
          name: 'PDS source tracking',
          query: `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = 'public' AND table_name LIKE '%_index' AND column_name = 'pds_url'`,
          expected: 8,
        },
        {
          name: 'No blob data',
          query: `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = 'public' AND table_name LIKE '%_index' AND data_type = 'bytea'`,
          expected: 0,
        },
        {
          name: 'Firehose infrastructure',
          query: `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('firehose_cursor', 'firehose_dlq')`,
          expected: 2,
        },
      ];

      for (const check of checks) {
        const result = await pool.query<{ count: string }>(check.query);
        expect(result.rows[0]).toBeDefined();
        const count = parseInt(result.rows[0]?.count ?? '0', 10);

        expect(count).toBe(check.expected);
      }
    });
  });
});
