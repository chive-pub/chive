import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const changelog = readFileSync(join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');

const released = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]!);
const linked = new Set([...changelog.matchAll(/^\[(\d+\.\d+\.\d+)\]:/gm)].map((m) => m[1]!));

/**
 * The link-reference block at the foot of the changelog had fallen three
 * releases behind: it stopped at 0.7.1 while 0.8.0, 0.8.1 and 0.9.0 had
 * shipped, and `[Unreleased]` compared against a version that was no longer the
 * latest. Every `## [x.y.z]` heading in the file rendered as literal brackets
 * with no link. Nothing checked it, and it had drifted this way once before.
 */
describe('changelog link references', () => {
  it('reads a non-trivial number of releases', () => {
    expect(released.length).toBeGreaterThan(5);
  });

  it('gives every released version a link reference', () => {
    for (const version of released) {
      expect(linked, `[${version}] has no link reference`).toContain(version);
    }
  });

  it('compares Unreleased against the most recent release', () => {
    const latest = released[0];
    const unreleased = /^\[Unreleased\]:.*compare\/v(\d+\.\d+\.\d+)\.\.\.HEAD$/m.exec(changelog);

    expect(unreleased, 'the Unreleased link is missing or malformed').not.toBeNull();
    expect(unreleased?.[1]).toBe(latest);
  });

  it('matches the version in package.json', () => {
    // A release commit that bumps the manifest and forgets the changelog, or
    // the reverse, leaves the two describing different releases.
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(released[0]).toBe(pkg.version);
  });

  it('keeps the three manifests on the same version', () => {
    const version = (file: string): string =>
      (JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8')) as { version: string }).version;

    expect(version('web/package.json')).toBe(version('package.json'));
    expect(version('docs/package.json')).toBe(version('package.json'));
  });
});
