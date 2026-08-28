import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const script = readFileSync(join(REPO_ROOT, 'scripts/publish-lexicons.ts'), 'utf8');

/**
 * The publisher reads `lexicons/` from the working tree, not from a tag. That
 * is convenient and it is a trap: publishing from a feature branch writes
 * schemas that have not shipped to the account external services resolve
 * `pub.chive.*` from.
 *
 * It nearly happened during the 0.10.0 release. A dry run listed eight changes
 * instead of the expected seven; the extra was a lexicon written minutes
 * earlier on an unmerged branch. Only the count gave it away — nothing in the
 * tool would have stopped the write.
 */
describe('the lexicon publisher refuses an unreleased checkout', () => {
  it('checks the working tree is clean before writing', () => {
    expect(script).toContain('git status --porcelain');
    expect(script).toContain('Refusing to publish from a dirty working tree');
  });

  it('requires the commit to carry a version tag', () => {
    expect(script).toContain('git tag --points-at HEAD');
    expect(script).toMatch(/carries no version tag/);
  });

  it('matches only release tags, not any tag that happens to be present', () => {
    // A `nightly` or `deploy-2026-08-28` tag must not satisfy the guard.
    expect(script).toContain('.test(t)');
    expect(script).toContain('\\d+\\.\\d+\\.\\d+');
  });

  it('always allows a dry run', () => {
    // Previewing from a branch is exactly how you check what a change would do,
    // so the guard must not block it.
    const guard = script.slice(
      script.indexOf('function assertPublishableCheckout'),
      script.indexOf('async function main')
    );
    expect(guard).toContain('if (dryRun || force) return;');
  });

  it('offers a named override rather than leaving no way out', () => {
    expect(script).toContain('--allow-dirty');
  });

  it('names the override in its usage line', () => {
    expect(script).toContain('[--dry-run] [--allow-dirty]');
  });
});
