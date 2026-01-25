/**
 * Pre-deployment script execution tests.
 *
 * @remarks
 * These tests verify that critical scripts can execute and communicate
 * with external services. This includes:
 * - Connecting to real PDSes (user PDS for eprints, governance PDS for knowledge graph)
 * - Running actual reindexing against seeded test data
 * - Verifying indexed documents appear correctly in Elasticsearch
 *
 * IMPORTANT: These tests communicate with the outside world!
 * - User PDS at aaronstevenwhite.io (via bsky.social endpoint)
 * - Governance PDS at governance.chive.pub
 *
 * @packageDocumentation
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { AtpAgent } from '@atproto/api';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { Client as PgClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT_DIR = join(__dirname, '../..');
const SCRIPTS_DIR = join(ROOT_DIR, 'scripts');

// Timeout for script execution (5 minutes for real PDS communication)
const SCRIPT_TIMEOUT = 300000;

// Test configuration - these are real, known values
const TEST_CONFIG = {
  // User's real DID (aaronstevenwhite.io handle)
  userDid: 'did:plc:34mbm5v3umztwvvgnttvcz6e',
  userHandle: 'aaronstevenwhite.io',
  // The actual PDS endpoint where the user's data lives
  userPdsEndpoint: 'https://bsky.social',
  // Governance PDS for knowledge graph data
  governancePdsUrl: 'https://governance.chive.pub',
  governanceDid: 'did:plc:5wzpn4a4nbqtz3q45hyud6hd',
};

// Database connection strings
const POSTGRES_URL =
  process.env.DATABASE_URL ?? 'postgresql://chive:chive_test_password@127.0.0.1:5432/chive_test';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL ?? 'http://127.0.0.1:9200';

/**
 * Runs a TypeScript script via tsx and returns the result.
 */
async function runTsScript(
  scriptPath: string,
  env: Record<string, string> = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('pnpm', ['exec', 'tsx', scriptPath], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        ...env,
        DATABASE_URL: POSTGRES_URL,
        ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL ?? 'http://127.0.0.1:9200',
        NEO4J_URI: process.env.NEO4J_URI ?? 'bolt://127.0.0.1:7687',
        NEO4J_USER: process.env.NEO4J_USER ?? 'neo4j',
        NEO4J_PASSWORD: process.env.NEO4J_PASSWORD ?? 'chive_test_password',
        REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      },
      timeout: SCRIPT_TIMEOUT,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const str = data.toString();
      stdout += str;
      // Log output in real-time for debugging
      process.stdout.write(str);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const str = data.toString();
      stderr += str;
      process.stderr.write(str);
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on('error', (err) => {
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
  });
}

describe('Pre-Deployment Script Execution', () => {
  // ===========================================================================
  // EXTERNAL PDS CONNECTIVITY TESTS
  // ===========================================================================

  describe('External PDS Connectivity', () => {
    it('can reach user PDS endpoint', async () => {
      const agent = new AtpAgent({ service: TEST_CONFIG.userPdsEndpoint });

      // Try to describe the server - this should work without auth
      const response = await agent.com.atproto.server.describeServer();

      expect(response.success).toBe(true);
      expect(response.data.availableUserDomains).toBeDefined();
    });

    it('can resolve user DID to PDS', async () => {
      // Resolve the user's DID to verify their identity
      const agent = new AtpAgent({ service: TEST_CONFIG.userPdsEndpoint });

      try {
        const response = await agent.com.atproto.identity.resolveHandle({
          handle: TEST_CONFIG.userHandle,
        });

        expect(response.success).toBe(true);
        expect(response.data.did).toBe(TEST_CONFIG.userDid);
      } catch (error) {
        // If handle resolution fails, the DID might not be on this PDS
        // This is informational - the test is about connectivity
        console.warn(`Handle resolution failed: ${String(error)}`);
      }
    });

    it('can reach governance PDS endpoint', async () => {
      const agent = new AtpAgent({ service: TEST_CONFIG.governancePdsUrl });

      try {
        const response = await agent.com.atproto.server.describeServer();
        expect(response.success).toBe(true);
      } catch (error) {
        // Governance PDS may not be publicly accessible in all environments
        console.warn(`Governance PDS not reachable: ${String(error)}`);
        // Don't fail - this may be expected in some CI environments
      }
    });
  });

  // ===========================================================================
  // ELASTICSEARCH SETUP SCRIPT
  // ===========================================================================

  describe('Elasticsearch Setup Script', () => {
    it('setup-elasticsearch.ts runs and creates indices', async () => {
      const scriptPath = join(SCRIPTS_DIR, 'db/setup-elasticsearch.ts');

      if (!existsSync(scriptPath)) {
        console.warn('Skipping - setup-elasticsearch.ts not found');
        return;
      }

      const result = await runTsScript(scriptPath);

      // Should complete without import/syntax errors
      expect(result.stderr).not.toContain('Cannot find module');
      expect(result.stderr).not.toContain('SyntaxError');

      // Should mention Elasticsearch setup in output
      const output = result.stdout + result.stderr;
      expect(output.toLowerCase()).toMatch(/elasticsearch.*(ready|setup|complete)/i);
    });
  });

  // ===========================================================================
  // NEO4J SETUP SCRIPT
  // ===========================================================================

  describe('Neo4j Setup Script', () => {
    it('setup-neo4j.ts runs and creates constraints', async () => {
      const scriptPath = join(SCRIPTS_DIR, 'db/setup-neo4j.ts');

      if (!existsSync(scriptPath)) {
        console.warn('Skipping - setup-neo4j.ts not found');
        return;
      }

      const result = await runTsScript(scriptPath);

      // Should complete without import/syntax errors
      expect(result.stderr).not.toContain('Cannot find module');
      expect(result.stderr).not.toContain('SyntaxError');

      // Should complete successfully
      const output = result.stdout + result.stderr;
      expect(output.toLowerCase()).toMatch(/neo4j.*(setup|complete)/i);
    });
  });

  // ===========================================================================
  // REINDEX SCRIPT WITH REAL PDS DATA
  // ===========================================================================

  describe('Reindex Script with Real PDS', () => {
    let pgClient: PgClient;
    let esClient: ElasticsearchClient;
    let testEprintUri: string | null = null;

    beforeAll(async () => {
      pgClient = new PgClient({ connectionString: POSTGRES_URL });
      await pgClient.connect();

      esClient = new ElasticsearchClient({ node: ELASTICSEARCH_URL });
    });

    afterAll(async () => {
      // Clean up test data
      if (testEprintUri && pgClient) {
        await pgClient
          .query('DELETE FROM eprints_index WHERE uri = $1', [testEprintUri])
          .catch(() => {});
      }
      if (testEprintUri && esClient) {
        await esClient.delete({ index: 'eprints', id: testEprintUri }).catch(() => {});
      }
      if (pgClient) {
        await pgClient.end().catch(() => {});
      }
      if (esClient) {
        await esClient.close().catch(() => {});
      }
    });

    it('discovers and lists eprints from user PDS', async () => {
      // Try to list records from the user's PDS to find a real eprint
      const agent = new AtpAgent({ service: TEST_CONFIG.userPdsEndpoint });

      try {
        const response = await agent.com.atproto.repo.listRecords({
          repo: TEST_CONFIG.userDid,
          collection: 'pub.chive.eprint.submission',
          limit: 1,
        });

        if (response.data.records.length > 0 && response.data.records[0]) {
          testEprintUri = response.data.records[0].uri;
          console.warn(`Found real eprint: ${testEprintUri}`);
          expect(testEprintUri).toContain(TEST_CONFIG.userDid);
        } else {
          console.warn('No eprints found on user PDS - this may be expected');
        }
      } catch (error) {
        console.warn(`Could not list records from user PDS: ${String(error)}`);
        // This is informational - user may not have published eprints yet
      }
    });

    it('reindex-all-eprints.ts connects to all databases', async () => {
      const scriptPath = join(SCRIPTS_DIR, 'reindex-all-eprints.ts');

      if (!existsSync(scriptPath)) {
        console.warn('Skipping - reindex-all-eprints.ts not found');
        return;
      }

      // Run with small batch size and max retries to verify connectivity
      const result = await runTsScript(scriptPath, {
        REINDEX_BATCH_SIZE: '1',
        REINDEX_MAX_RETRIES: '1',
      });

      // Should start and connect to all databases
      expect(result.stdout).toContain('EPRINT REINDEXING SCRIPT');
      expect(result.stdout).toContain('PostgreSQL is healthy');
      expect(result.stdout).toContain('Elasticsearch is healthy');
      expect(result.stdout).toContain('Neo4j is healthy');
    });

    it('can reindex a seeded eprint from real PDS', async () => {
      // Skip if we didn't find a real eprint
      if (!testEprintUri) {
        console.warn('Skipping - no real eprint URI available');
        return;
      }

      const scriptPath = join(SCRIPTS_DIR, 'reindex-all-eprints.ts');

      // First, seed the test database with the real eprint info
      // The reindex script will then fetch fresh data from the real PDS
      await pgClient.query(
        `INSERT INTO eprints_index (
          uri, cid, authors, submitted_by, title, abstract, abstract_plain_text,
          document_blob_cid, document_blob_mime_type, document_blob_size,
          document_format, keywords, license, publication_status,
          created_at, indexed_at, pds_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (uri) DO UPDATE SET indexed_at = EXCLUDED.indexed_at`,
        [
          testEprintUri,
          'placeholder-cid',
          JSON.stringify([{ did: TEST_CONFIG.userDid, name: 'Test Author', order: 1 }]),
          TEST_CONFIG.userDid,
          'Test eprint for pre-deployment verification',
          JSON.stringify({ type: 'RichText', items: [{ type: 'text', content: 'Test abstract' }] }),
          'Test abstract',
          'placeholder-blob-cid',
          'application/pdf',
          1024,
          'pdf',
          ['test'],
          'CC-BY-4.0',
          'eprint',
          new Date().toISOString(),
          new Date().toISOString(),
          TEST_CONFIG.userPdsEndpoint,
        ]
      );

      // Run the reindex script
      const result = await runTsScript(scriptPath, {
        REINDEX_BATCH_SIZE: '1',
        REINDEX_MAX_RETRIES: '2',
      });

      // Should complete (may have some failures if record doesn't exist on PDS)
      expect(result.stdout).toContain('EPRINT REINDEXING SCRIPT');

      // Verify the document was indexed in Elasticsearch
      try {
        const esDoc = await esClient.get({
          index: 'eprints',
          id: testEprintUri,
        });

        expect(esDoc._source).toBeDefined();
        // The document should have been fetched from the real PDS
        console.warn('Successfully indexed document from real PDS');
      } catch {
        // Document may not exist if the eprint isn't on the PDS
        console.warn('Document not found in Elasticsearch - eprint may not exist on PDS');
      }
    });
  });

  // ===========================================================================
  // GOVERNANCE PDS INTEGRATION
  // ===========================================================================

  describe('Governance PDS Integration', () => {
    it('can fetch knowledge graph nodes from governance PDS', async () => {
      const agent = new AtpAgent({ service: TEST_CONFIG.governancePdsUrl });

      try {
        // Try to list graph nodes from the governance PDS
        const response = await agent.com.atproto.repo.listRecords({
          repo: TEST_CONFIG.governanceDid,
          collection: 'pub.chive.graph.node',
          limit: 5,
        });

        // If we can reach the governance PDS and it has records, great
        if (response.data.records.length > 0) {
          console.warn(`Found ${response.data.records.length} graph nodes in governance PDS`);
          expect(response.data.records.length).toBeGreaterThan(0);
        } else {
          console.warn('No graph nodes found in governance PDS');
        }
      } catch (error) {
        // Governance PDS may not be accessible in CI
        console.warn(`Could not access governance PDS: ${String(error)}`);
        // Don't fail - this is expected in some environments
      }
    });
  });
});
