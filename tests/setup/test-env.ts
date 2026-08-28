/**
 * Default connection settings for the local test stack.
 *
 * @remarks
 * `getDatabaseConfig()` defaults `POSTGRES_DB` to `chive`, which is right for a
 * deployment reading its configuration from the environment. The Docker test
 * stack creates `chive_test`, so following the documented local flow —
 * `./scripts/start-test-stack.sh` then `npm run test:compliance` — failed at
 * migration time with `role "chive" does not exist`, a message that points at
 * authentication rather than at the database name actually responsible.
 *
 * These defaults close that gap. Every one of them yields to an explicit value:
 * CI sets the same variables, and a developer pointing the suite at another
 * instance keeps doing so.
 *
 * @packageDocumentation
 */

/** Connection settings matching `docker/docker-compose.yml`. */
export const TEST_STACK_DEFAULTS: Readonly<Record<string, string>> = {
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_PORT: '5432',
  POSTGRES_DB: 'chive_test',
  POSTGRES_USER: 'chive',
  POSTGRES_PASSWORD: 'chive_test_password',
  ELASTICSEARCH_URL: 'http://127.0.0.1:9200',
  REDIS_URL: 'redis://127.0.0.1:6379',
  NEO4J_URI: 'bolt://127.0.0.1:7687',
  NEO4J_USER: 'neo4j',
  NEO4J_PASSWORD: 'chive_test_password',
};

/**
 * Resolve the test environment, preferring anything already set.
 *
 * @returns The variables to expose to tests
 *
 * @remarks
 * Returning rather than mutating lets a Vitest config spread the result into
 * `test.env` without a side effect at config-load time.
 *
 * @public
 */
export function testStackEnv(): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, fallback] of Object.entries(TEST_STACK_DEFAULTS)) {
    resolved[key] = process.env[key] ?? fallback;
  }
  return resolved;
}

/**
 * Apply the defaults to `process.env` for anything running outside a test file.
 *
 * @remarks
 * Global setup runs migrations in the main process, before `test.env` reaches
 * any worker, so it needs the values on `process.env` itself.
 *
 * @public
 */
export function applyTestStackDefaults(): void {
  for (const [key, value] of Object.entries(TEST_STACK_DEFAULTS)) {
    process.env[key] ??= value;
  }
}
