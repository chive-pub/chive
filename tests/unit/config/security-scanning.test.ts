/**
 * Unit tests for the presence of security scanning configuration.
 *
 * @remarks
 * The repository ran no scanning of any kind — no SAST, no dependency audit, no
 * container scan, no Dependabot — while the architecture overview described
 * scanning as part of the pipeline. The gap survived precisely because nothing
 * asserted it, so these tests pin the configuration's existence and the parts
 * of its shape that matter.
 *
 * They deliberately do not assert that the dependency audit gates the build.
 * It does not, and that is a recorded decision: the tree carries a large
 * backlog of transitive advisories, and a gate switched on before that is
 * worked down would block every pull request on pre-existing debt.
 *
 * Assertions are made against the file text rather than a parsed document,
 * since the repository carries no YAML parser and adding one for a test is not
 * worth the dependency.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');
const exists = (relative: string): boolean => existsSync(join(process.cwd(), relative));

describe('security scanning workflow', () => {
  const path = '.github/workflows/security.yml';

  it('exists', () => {
    expect(exists(path)).toBe(true);
  });

  it.each([
    ['SAST', /^ {2}codeql:$/m],
    ['dependency audit', /^ {2}dependency-audit:$/m],
    ['filesystem scan', /^ {2}filesystem-scan:$/m],
  ])('defines a %s job', (_label, pattern) => {
    expect(read(path)).toMatch(pattern);
  });

  it('grants the permission needed to publish findings', () => {
    expect(read(path)).toMatch(/security-events:\s*write/);
  });

  // A scan that only runs on push misses advisories disclosed after the last
  // commit, which is most of them.
  it('runs on a schedule as well as on pull requests', () => {
    const contents = read(path);
    expect(contents).toMatch(/^\s{2}schedule:$/m);
    expect(contents).toMatch(/^\s{2}pull_request:$/m);
  });

  it('analyses this repository languages with CodeQL', () => {
    expect(read(path)).toMatch(/languages:\s*javascript-typescript/);
  });
});

describe('dependabot configuration', () => {
  const path = '.github/dependabot.yml';

  it('exists', () => {
    expect(exists(path)).toBe(true);
  });

  // Dependabot does not follow pnpm workspaces from the root manifest, so each
  // workspace holding its own package.json needs its own entry or it is simply
  // never updated.
  it.each([['/'], ['/web'], ['/docs']])('covers the %s manifest', (directory) => {
    const entries = [...read(path).matchAll(/directory:\s*(\S+)/g)].map((match) => match[1]);
    expect(entries).toContain(directory);
  });

  it('keeps workflow actions updated too', () => {
    expect(read(path)).toMatch(/package-ecosystem:\s*github-actions/);
  });

  // Grouping production separately keeps a runtime bump from being buried in a
  // batch of tooling updates.
  it('separates production from development updates', () => {
    const contents = read(path);
    expect(contents).toMatch(/dependency-type:\s*production/);
    expect(contents).toMatch(/dependency-type:\s*development/);
  });
});
