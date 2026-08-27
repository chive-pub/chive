import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function json(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8')) as Record<string, unknown>;
}

/**
 * There were two parallel routes to frontend API types. Only one was used.
 *
 * `pnpm openapi:generate` fetched `/openapi.json` from a running backend and
 * wrote a 648KB `web/lib/api/schema.generated.ts`. Nothing imported it —
 * `client.ts` takes its types from `lib/api/generated/`, which comes from the
 * lexicons — and the file was gitignored and needed a live server on :3001, so
 * CI could neither produce it nor notice it was absent. Contributors were
 * nonetheless told to run it after every API change.
 */
describe('there is one route to frontend API types', () => {
  it('declares no OpenAPI type-generation script', () => {
    const root = json('package.json').scripts as Record<string, string>;
    const web = json('web/package.json').scripts as Record<string, string>;
    expect(root).not.toHaveProperty('openapi:generate');
    expect(web).not.toHaveProperty('openapi:generate');
  });

  it('does not ship the generator script', () => {
    expect(existsSync(join(REPO_ROOT, 'scripts/generate-api-types.sh'))).toBe(false);
  });

  it('generates the client from lexicons instead', () => {
    const root = json('package.json').scripts as Record<string, string>;
    expect(root).toHaveProperty('lexicons:generate');
  });

  it('has the API client importing the lexicon-generated types', () => {
    const client = readFileSync(join(REPO_ROOT, 'web/lib/api/client.ts'), 'utf8');
    expect(client).toContain("from './generated/index'");
    expect(client).not.toContain('schema.generated');
  });

  it('no longer ignores a file nothing produces', () => {
    const ignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8');
    expect(ignore).not.toContain('web/lib/api/schema.generated.ts');
  });
});
