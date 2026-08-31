/**
 * Tests for Tangled as a linked code artifact.
 *
 * @remarks
 * Tangled hosts git repositories as ATProto records (`sh.tangled.repo`), so a
 * repository there is addressable by AT-URI and not only by web URL. Chive's
 * platform vocabulary previously named only web-hosted forges, which meant a
 * Tangled repository could be recorded as a URL and nothing more — losing the
 * fact that it is a record on the same network as the eprint citing it.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const submission = JSON.parse(
  readFileSync(join(REPO_ROOT, 'lexicons/pub/chive/eprint/submission.json'), 'utf8')
) as {
  defs: {
    codeRepository: {
      properties: Record<string, { format?: string; knownValues?: string[] }>;
    };
  };
};

const codeRepository = submission.defs.codeRepository;

describe('Tangled as a code platform', () => {
  it('is one of the known platform slugs', () => {
    expect(codeRepository.properties.platformSlug?.knownValues).toContain('tangled');
  });

  it('does not displace the forges already known', () => {
    const slugs = codeRepository.properties.platformSlug?.knownValues ?? [];
    for (const existing of ['github', 'gitlab', 'codeberg', 'sourcehut', 'software_heritage']) {
      expect(slugs).toContain(existing);
    }
  });

  it('a code repository can be addressed by AT-URI', () => {
    // The point of the change: `url` addresses a repository at one web host,
    // `recordUri` addresses the record on the network, which survives that host
    // moving or disappearing.
    expect(codeRepository.properties.recordUri).toBeDefined();
    expect(codeRepository.properties.recordUri?.format).toBe('at-uri');
  });

  it('keeps the web URL, since most forges are not on ATProto', () => {
    expect(codeRepository.properties.url).toBeDefined();
  });
});

describe('the frontend knows how to label Tangled', () => {
  it('has a platform entry, so a Tangled repo does not render unlabelled', () => {
    const panel = readFileSync(
      join(REPO_ROOT, 'web/components/eprints/repositories-panel.tsx'),
      'utf8'
    );
    expect(panel).toMatch(/tangled:\s*\{/);
    expect(panel).toMatch(/label: 'Tangled'/);
  });
});
