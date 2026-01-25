/**
 * Pre-deployment service verification tests.
 *
 * @remarks
 * These tests verify that all critical services, jobs, and scripts
 * function correctly before deployment. They run against the full
 * test stack with realistic data.
 *
 * @packageDocumentation
 */

import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { Redis } from 'ioredis';
import neo4j, { Driver } from 'neo4j-driver';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const TEST_CONFIG = {
  postgres: {
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://chive:chive_test_password@127.0.0.1:5432/chive',
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_URL ?? 'http://127.0.0.1:9200',
  },
  neo4j: {
    uri: process.env.NEO4J_URI ?? 'bolt://127.0.0.1:7687',
    user: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'chive_test_password',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  },
};

// =============================================================================
// TEST SUITE
// =============================================================================

describe('Pre-Deployment Service Verification', () => {
  let pgPool: Pool;
  let esClient: ElasticsearchClient;
  let neo4jDriver: Driver;
  let redisClient: Redis;

  beforeAll(() => {
    // Connect to all services
    pgPool = new Pool({ connectionString: TEST_CONFIG.postgres.connectionString });
    esClient = new ElasticsearchClient({ node: TEST_CONFIG.elasticsearch.node });
    neo4jDriver = neo4j.driver(
      TEST_CONFIG.neo4j.uri,
      neo4j.auth.basic(TEST_CONFIG.neo4j.user, TEST_CONFIG.neo4j.password)
    );
    redisClient = new Redis(TEST_CONFIG.redis.url);
  });

  afterAll(async () => {
    await pgPool.end();
    await esClient.close();
    await neo4jDriver.close();
    await redisClient.quit();
  });

  // ===========================================================================
  // SERVICE HEALTH CHECKS
  // ===========================================================================

  describe('Service Health', () => {
    it('PostgreSQL is healthy and accessible', async () => {
      const result = await pgPool.query('SELECT 1 as health');
      expect(result.rows[0]?.health).toBe(1);
    });

    it('Elasticsearch is healthy', async () => {
      const health = await esClient.cluster.health();
      expect(['green', 'yellow']).toContain(health.status);
    });

    it('Neo4j is healthy and accessible', async () => {
      const session = neo4jDriver.session();
      try {
        const result = await session.run('RETURN 1 as health');
        expect(result.records[0]?.get('health').toNumber()).toBe(1);
      } finally {
        await session.close();
      }
    });

    it('Redis is healthy and accessible', async () => {
      const pong = await redisClient.ping();
      expect(pong).toBe('PONG');
    });
  });

  // ===========================================================================
  // ELASTICSEARCH SCHEMA VERIFICATION
  // ===========================================================================

  describe('Elasticsearch Schema', () => {
    it('eprints index exists with correct alias', async () => {
      const aliasExists = await esClient.indices.existsAlias({ name: 'eprints' });
      expect(aliasExists).toBe(true);
    });

    it('field_nodes mapping is nested type with id and label', async () => {
      const mapping = await esClient.indices.getMapping({ index: 'eprints' });
      const indexName = Object.keys(mapping)[0] as string | undefined;
      expect(indexName).toBeDefined();
      const fieldNodesMapping = mapping[indexName!]?.mappings?.properties?.field_nodes as
        | { type: string; properties?: Record<string, { type: string }> }
        | undefined;

      expect(fieldNodesMapping).toBeDefined();
      expect(fieldNodesMapping?.type).toBe('nested');
      expect(fieldNodesMapping?.properties?.id?.type).toBe('keyword');
      expect(fieldNodesMapping?.properties?.label).toBeDefined();
    });

    it('ingest pipeline exists', async () => {
      const pipeline = await esClient.ingest.getPipeline({ id: 'eprint-processing' });
      expect(pipeline['eprint-processing']).toBeDefined();
    });
  });

  // ===========================================================================
  // NEO4J SCHEMA VERIFICATION
  // ===========================================================================

  describe('Neo4j Schema', () => {
    it('Field nodes exist with labels', async () => {
      const session = neo4jDriver.session();
      try {
        const result = await session.run(`
          MATCH (f:Field)
          WHERE f.label IS NOT NULL
          RETURN count(f) as count
        `);
        const count = result.records[0]?.get('count').toNumber();
        expect(count).toBeGreaterThan(0);
      } finally {
        await session.close();
      }
    });

    it('indexes exist for common queries', async () => {
      const session = neo4jDriver.session();
      try {
        const result = await session.run('SHOW INDEXES');
        const indexes = result.records.map((r) => String(r.get('name')));
        // At minimum, we should have some indexes
        expect(indexes.length).toBeGreaterThan(0);
      } finally {
        await session.close();
      }
    });
  });

  // ===========================================================================
  // INDEXING PIPELINE VERIFICATION
  // ===========================================================================

  describe('Indexing Pipeline', () => {
    const testUri = 'at://did:plc:test-verification/pub.chive.eprint.submission/test123';

    afterAll(async () => {
      // Clean up test document
      try {
        await esClient.delete({ index: 'eprints', id: testUri });
      } catch {
        // Ignore if doesn't exist
      }
    });

    it('can index document with nested field_nodes', async () => {
      const testDocument = {
        uri: testUri,
        title: 'Pre-deployment Verification Test',
        abstract: 'This is a test document for pre-deployment verification.',
        authors: [{ did: 'did:plc:test', name: 'Test Author', order: 0 }],
        submitted_by: 'did:plc:test',
        field_nodes: [
          { id: 'test-field-1', label: 'Test Field One' },
          { id: 'test-field-2', label: 'Test Field Two' },
        ],
        keywords: ['test', 'verification'],
        created_at: new Date().toISOString(),
        indexed_at: new Date().toISOString(),
        pds_url: 'https://test.pds.example',
      };

      await esClient.index({
        index: 'eprints',
        id: testUri,
        document: testDocument,
        refresh: true,
      });

      // Verify document was indexed correctly
      const doc = await esClient.get({ index: 'eprints', id: testUri });
      const source = doc._source as Record<string, unknown>;

      expect(source.uri).toBe(testUri);
      expect(source.field_nodes).toHaveLength(2);

      const fieldNodes = source.field_nodes as { id: string; label: string }[];
      expect(fieldNodes[0]?.id).toBe('test-field-1');
      expect(fieldNodes[0]?.label).toBe('Test Field One');
    });

    it('can search by nested field_nodes.id', async () => {
      const result = await esClient.search({
        index: 'eprints',
        query: {
          nested: {
            path: 'field_nodes',
            query: {
              term: { 'field_nodes.id': 'test-field-1' },
            },
          },
        },
      });

      expect(result.hits.total).toBeDefined();
      const total =
        typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value;
      expect(total).toBeGreaterThan(0);
    });

    it('can aggregate by nested field_nodes.label', async () => {
      const result = await esClient.search({
        index: 'eprints',
        size: 0,
        aggs: {
          subjects: {
            nested: { path: 'field_nodes' },
            aggs: {
              labels: {
                terms: { field: 'field_nodes.label.keyword', size: 10 },
              },
            },
          },
        },
      });

      expect(result.aggregations?.subjects).toBeDefined();
    });
  });

  // ===========================================================================
  // DATABASE SCHEMA VERIFICATION
  // ===========================================================================

  describe('PostgreSQL Schema', () => {
    it('eprints_index table exists with required columns', async () => {
      const result = await pgPool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'eprints_index'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.map((r) => String(r.column_name));
      expect(columns).toContain('uri');
      expect(columns).toContain('pds_url');
      expect(columns).toContain('fields');
      expect(columns).toContain('submitted_by');
    });

    it('required indexes exist', async () => {
      const result = await pgPool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'eprints_index'
      `);

      const indexes = result.rows.map((r) => String(r.indexname));
      expect(indexes.length).toBeGreaterThan(0);
    });
  });
});
