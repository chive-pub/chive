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

function main(): void {
  const spec = generateOpenAPISpec();
  const serialized = `${JSON.stringify(spec, null, 2)}\n`;

  if (process.argv.includes('--check')) {
    let current: string;
    try {
      current = readFileSync(OUTPUT, 'utf8');
    } catch {
      console.error(`✗ ${OUTPUT} is missing. Run: pnpm docs:openapi`);
      process.exit(1);
    }

    if (current !== serialized) {
      console.error(
        '✗ docs/openapi/chive-api.json is out of date with the registered XRPC methods.\n' +
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
