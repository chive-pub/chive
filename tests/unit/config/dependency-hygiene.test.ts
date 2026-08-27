import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  pnpm?: { overrides?: Record<string, string> };
};

const declared = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

describe('dependency hygiene', () => {
  it('declares no second-factor authentication packages', () => {
    // 2FA was removed in 0.9.0 — no route, handler or service reached it — but
    // its dependencies stayed declared, which reads as a feature the service
    // still has and keeps their CVEs in the audit surface.
    for (const name of Object.keys(declared)) {
      expect(name, `${name} is a leftover 2FA dependency`).not.toMatch(
        /^(otplib|@otplib\/|@simplewebauthn\/)/
      );
    }
  });

  it('does not override vm2 with isolated-vm', () => {
    // `vm2` is not in the dependency tree. The override was inert, and would be
    // actively harmful if a transitive dependency ever pulled vm2 in: it would
    // be silently replaced with isolated-vm, whose API is incompatible, turning
    // a resolvable version conflict into a runtime crash.
    expect(pkg.pnpm?.overrides ?? {}).not.toHaveProperty('vm2');
  });

  it('declares one Redis client, not two', () => {
    // node-redis was a production dependency used by a single script while
    // every service module uses ioredis.
    expect(declared).not.toHaveProperty('redis');
    expect(declared).toHaveProperty('ioredis');
  });
});
