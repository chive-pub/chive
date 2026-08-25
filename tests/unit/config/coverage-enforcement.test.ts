/**
 * Unit tests for coverage threshold enforcement.
 *
 * @remarks
 * The coverage bar was unenforced end to end on the frontend: `web/vitest.config.ts`
 * declared no thresholds, and CI ran the web suite without `--coverage`, so nothing
 * ever evaluated one. The stated bar in the project documentation was 70%; the real
 * figure had drifted to roughly 41% of lines without anything noticing.
 *
 * These tests pin that thresholds exist and that CI measures them. They deliberately
 * do not assert the values match the documented bar — they do not, and closing that
 * gap is test-writing work rather than a config change. Asserting the aspiration here
 * would either be false or force every pull request to carry pre-existing debt.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

describe('coverage thresholds are declared', () => {
  it.each([
    ['backend', 'vitest.unit.config.ts'],
    ['frontend', 'web/vitest.config.ts'],
  ])('%s config declares thresholds', (_label, path) => {
    expect(read(path)).toMatch(/thresholds:\s*\{/);
  });

  it.each([
    ['backend', 'vitest.unit.config.ts'],
    ['frontend', 'web/vitest.config.ts'],
  ])('%s thresholds cover lines, statements, branches and functions', (_label, path) => {
    const contents = read(path);
    for (const metric of ['lines', 'statements', 'branches', 'functions']) {
      expect(contents).toMatch(new RegExp(`${metric}:\\s*\\d+`));
    }
  });
});

describe('CI evaluates the thresholds', () => {
  const workflow = read('.github/workflows/ci.yml');

  it('runs the backend suite with coverage', () => {
    expect(workflow).toMatch(/pnpm test:unit --coverage/);
  });

  // Without this flag the frontend thresholds are never evaluated, which is
  // exactly how the bar came to be unenforced.
  it('runs the frontend suite with coverage', () => {
    expect(workflow).toMatch(/@chive\/web test -- --coverage/);
  });
});
