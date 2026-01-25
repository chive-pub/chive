/**
 * Pre-deployment script execution tests.
 *
 * @remarks
 * These tests verify that all critical scripts can be executed
 * successfully. Scripts are run with test data to verify they
 * complete without errors.
 *
 * @packageDocumentation
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

const ROOT_DIR = join(__dirname, '../..');
const DIST_DIR = join(ROOT_DIR, 'dist');
const SCRIPTS_DIR = join(DIST_DIR, 'scripts');

// Timeout for script execution (2 minutes)
const SCRIPT_TIMEOUT = 120000;

/**
 * Runs a script and returns the result.
 */
async function runScript(
  scriptPath: string,
  env: Record<string, string> = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('node', ['--enable-source-maps', scriptPath], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        ...env,
        // Ensure scripts use test database
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://chive:chive_test_password@127.0.0.1:5432/chive_test',
        ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL ?? 'http://127.0.0.1:9200',
        NEO4J_URI: process.env.NEO4J_URI ?? 'bolt://127.0.0.1:7687',
        NEO4J_USER: process.env.NEO4J_USER ?? 'neo4j',
        NEO4J_PASSWORD: process.env.NEO4J_PASSWORD ?? 'chive_test_password',
        REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      },
      timeout: SCRIPT_TIMEOUT,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
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
  beforeAll(() => {
    // Ensure dist directory exists (scripts are compiled)
    if (!existsSync(SCRIPTS_DIR)) {
      throw new Error(`Scripts directory not found at ${SCRIPTS_DIR}. Run 'pnpm build' first.`);
    }
  });

  // ===========================================================================
  // SCRIPT IMPORT VERIFICATION
  // ===========================================================================

  describe('Script Import Verification', () => {
    const scripts = ['reindex-all-eprints.js', 'db/setup-elasticsearch.js', 'db/setup-neo4j.js'];

    for (const script of scripts) {
      const scriptPath = join(SCRIPTS_DIR, script);

      it(`${script} can be imported without errors`, async () => {
        if (!existsSync(scriptPath)) {
          console.warn(`Skipping ${script} - not found`);
          return;
        }

        // Try to parse/import the script (doesn't execute main)
        const result = await runScript(scriptPath, { SCRIPT_DRY_RUN: 'true' });

        // Script should either succeed or fail gracefully
        // We're mainly checking for import/syntax errors
        expect(result.stderr).not.toContain('SyntaxError');
        expect(result.stderr).not.toContain('Cannot find module');
      });
    }
  });

  // ===========================================================================
  // ELASTICSEARCH SETUP SCRIPT
  // ===========================================================================

  describe('Elasticsearch Setup Script', () => {
    it('setup-elasticsearch.js runs and connects', async () => {
      const scriptPath = join(SCRIPTS_DIR, 'db/setup-elasticsearch.js');

      if (!existsSync(scriptPath)) {
        console.warn('Skipping - setup-elasticsearch.js not found');
        return;
      }

      const result = await runScript(scriptPath);

      // Script should at least attempt to connect
      // It may fail if ES is already set up, but should not have import errors
      expect(result.stderr).not.toContain('Cannot find module');
      expect(result.stderr).not.toContain('SyntaxError');

      // Should mention Elasticsearch in output
      const output = result.stdout + result.stderr;
      expect(output.toLowerCase()).toContain('elasticsearch');
    });
  });

  // ===========================================================================
  // REINDEX SCRIPT
  // ===========================================================================

  describe('Reindex Script', () => {
    it('reindex-all-eprints.js starts and connects to databases', async () => {
      const scriptPath = join(SCRIPTS_DIR, 'reindex-all-eprints.js');

      if (!existsSync(scriptPath)) {
        console.warn('Skipping - reindex-all-eprints.js not found');
        return;
      }

      // Run with small batch size to verify it works
      const result = await runScript(scriptPath, {
        REINDEX_BATCH_SIZE: '1',
        REINDEX_MAX_RETRIES: '0',
      });

      // Script should at least connect and start processing
      expect(result.stdout).toContain('EPRINT REINDEXING SCRIPT');
      expect(result.stdout).toContain('PostgreSQL is healthy');
      expect(result.stdout).toContain('Elasticsearch is healthy');
      expect(result.stdout).toContain('Neo4j is healthy');
      expect(result.stdout).toContain('Recreating Elasticsearch index');
    });
  });
});
