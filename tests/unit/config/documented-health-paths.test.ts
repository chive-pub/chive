import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { HEALTH_PATHS } from '@/api/config.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function markdownFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.docusaurus') {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(full, out);
    else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

/**
 * The docs described four health endpoints that do not exist —
 * `/health/live`, `/health/ready`, `/health/liveness`, `/health/readiness` —
 * while the service serves `/health` and `/ready`. One of them shipped inside a
 * copy-pasteable Kubernetes probe snippet, so following the documentation
 * produced pods that never pass their readiness gate.
 */
describe('documented health endpoints exist', () => {
  const docs = markdownFiles(join(REPO_ROOT, 'docs'));

  it('reads a non-trivial number of documents', () => {
    expect(docs.length).toBeGreaterThan(10);
  });

  it('serves liveness at /health and readiness at /ready', () => {
    expect(HEALTH_PATHS.liveness).toBe('/health');
    expect(HEALTH_PATHS.readiness).toBe('/ready');
  });

  it('mentions no health path the service does not serve', () => {
    const invalid = /\/health\/(live|ready|liveness|readiness)\b/;

    for (const file of docs) {
      const contents = readFileSync(file, 'utf8');
      const match = invalid.exec(contents);
      expect(
        match?.[0],
        `${file.slice(REPO_ROOT.length + 1)} documents ${match?.[0]}`
      ).toBeUndefined();
    }
  });
});
