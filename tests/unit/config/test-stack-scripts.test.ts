import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function read(file: string): string {
  return readFileSync(join(REPO_ROOT, file), 'utf8');
}

/**
 * The test stack scripts and docker-compose have to agree on the database
 * name, and a failed migration has to be visible. They disagreed, and the
 * migration step swallowed its own error and printed success anyway — so
 * `./scripts/start-test-stack.sh` reported a ready stack with no schema, and
 * the failure surfaced much later as an unrelated-looking error.
 */
describe('test stack scripts', () => {
  const compose = read('docker/docker-compose.yml');
  const start = read('scripts/start-test-stack.sh');
  const seed = read('scripts/seed-test-data.sh');

  it('docker-compose names the database the scripts expect', () => {
    const match = /POSTGRES_DB:\s*(\S+)/.exec(compose);
    expect(match?.[1]).toBe('chive_test');
  });

  it('the start script connects to that database', () => {
    expect(start).toContain('PG_DATABASE="chive_test"');
    // No literal /chive left over: that database does not exist in the stack.
    expect(start).not.toMatch(/127\.0\.0\.1:5432\/chive"/);
  });

  it('the seed script defaults to that database', () => {
    expect(seed).toContain('5432/chive_test}');
  });

  it('a failed migration is not swallowed', () => {
    // `2>/dev/null || true` discarded both the output and the exit status.
    // Other `|| true` uses in this script are fine — tearing down a stack that
    // may not exist, for instance — so this looks only at the migration step.
    const migrationBlock = start.slice(
      start.indexOf('Running database migrations'),
      start.indexOf('Seeding test data')
    );
    expect(migrationBlock).not.toContain('2>/dev/null');
    expect(migrationBlock).not.toContain('|| true');
  });

  it('a failed migration stops the script', () => {
    const migrationBlock = start.slice(
      start.indexOf('Running database migrations'),
      start.indexOf('Seeding test data')
    );
    expect(migrationBlock).toContain('exit 1');
  });

  it('still reports success only after the migration succeeds', () => {
    const migrationBlock = start.slice(
      start.indexOf('Running database migrations'),
      start.indexOf('Seeding test data')
    );
    expect(migrationBlock.indexOf('exit 1')).toBeLessThan(
      migrationBlock.indexOf('✓ Migrations complete')
    );
  });
});
