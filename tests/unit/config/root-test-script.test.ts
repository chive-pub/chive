/**
 * Unit tests for the repository's root `test` script.
 *
 * @remarks
 * The root package is not a pnpm workspace member — the workspace covers
 * `packages/*`, `web` and `docs` — so `turbo test` fans out to `web` alone and
 * never reaches the backend suite under `src/`. For a while the root script was
 * exactly `turbo test`, which meant `pnpm test` exited zero having run no
 * backend tests at all: the obvious command reported success while the thing it
 * was meant to check went unrun. CI is unaffected, since it calls `test:unit`,
 * `test:integration` and `test:compliance` explicitly, but anyone (or any agent)
 * trusting `pnpm test` was reading a false green.
 *
 * This pins the invariant rather than the exact command: whatever the root
 * script grows into, it has to reach the backend unit suite.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

interface PackageManifest {
  readonly scripts?: Readonly<Record<string, string>>;
}

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8')
) as PackageManifest;

describe('root test script', () => {
  it('runs the backend unit suite and not only the workspace tasks', () => {
    const script = manifest.scripts?.test;
    expect(script).toBeDefined();
    expect(script).toMatch(/test:unit|vitest\.unit\.config/);
  });

  it('still fans out to the workspace packages', () => {
    expect(manifest.scripts?.test).toMatch(/turbo test/);
  });

  it('keeps the backend unit script pointed at the unit config', () => {
    expect(manifest.scripts?.['test:unit']).toMatch(/vitest\.unit\.config/);
  });
});
