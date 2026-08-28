/**
 * Write the OpenAPI specification the documentation site serves.
 *
 * @remarks
 * `docs/openapi/chive-api.json` had not been regenerated in about five months
 * and was missing fifteen XRPC handlers, including the whole `atproto/` group.
 * The documented API and the served one had simply drifted apart, and nothing
 * compared them.
 *
 * It is written from `generateOpenAPISpec()`, the same function that serves
 * `/openapi.json`, which takes no arguments and reads the registered method
 * table. No running server is needed — the reason the file went stale is that
 * the only way anyone knew to produce it was to start one and curl it.
 *
 * Usage:
 *   pnpm docs:openapi           # write the spec
 *   pnpm docs:openapi --check   # fail if it would change
 *
 * @packageDocumentation
 */

/* eslint-disable no-console */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateOpenAPISpec } from '../src/api/openapi/index.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(REPO_ROOT, 'docs/openapi/chive-api.json');

/**
 * Serialize with every object's keys in sorted order.
 *
 * @remarks
 * `generateOpenAPISpec()` builds its path and schema maps by iterating module
 * registries, so insertion order follows the order the lexicon generator
 * emitted files — which differs between a macOS `find` and a Linux one. Writing
 * in insertion order makes the file byte-different on two machines that agree
 * completely about the API, which would turn the drift check below into a
 * platform test. Sorting makes the output a function of the content alone.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== 'object') return value;

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  return Object.fromEntries(entries.map(([k, v]) => [k, canonical(v)]));
}

function main(): void {
  const spec = generateOpenAPISpec();
  const serialized = `${JSON.stringify(canonical(spec), null, 2)}\n`;

  if (process.argv.includes('--check')) {
    let current: string;
    try {
      current = readFileSync(OUTPUT, 'utf8');
    } catch {
      console.error(`✗ ${OUTPUT} is missing. Run: pnpm docs:openapi`);
      process.exit(1);
    }

    if (current !== serialized) {
      // Name what moved. A bare "out of date" leaves the reader to diff an
      // 18,000-line file by hand to learn whether an endpoint appeared or a
      // description changed.
      const paths = (text: string): string[] =>
        Object.keys((JSON.parse(text) as { paths?: Record<string, unknown> }).paths ?? {});
      let detail = '';
      try {
        const before = new Set(paths(current));
        const after = new Set(paths(serialized));
        const added = [...after].filter((p) => !before.has(p));
        const removed = [...before].filter((p) => !after.has(p));
        if (added.length > 0) detail += `\n  added:   ${added.join(', ')}`;
        if (removed.length > 0) detail += `\n  removed: ${removed.join(', ')}`;
        if (added.length === 0 && removed.length === 0) {
          detail = '\n  the same paths, with different contents';
        }
      } catch {
        detail = '\n  (the current file could not be parsed)';
      }

      console.error(
        `✗ docs/openapi/chive-api.json is out of date with the registered XRPC methods.${detail}\n` +
          '  Run: pnpm docs:openapi'
      );
      process.exit(1);
    }

    console.log('✓ docs/openapi/chive-api.json matches the served specification');
    return;
  }

  writeFileSync(OUTPUT, serialized);
  const pathCount = Object.keys(spec.paths ?? {}).length;
  console.log(`✓ Wrote ${pathCount} paths to docs/openapi/chive-api.json`);
}

main();
