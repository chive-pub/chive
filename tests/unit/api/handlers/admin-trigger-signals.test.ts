/**
 * Tests for admin trigger endpoints.
 *
 * @remarks
 * `BackfillManager.startOperation` returns `{operation, signal}`. Handlers that
 * run work in the background must read the signal: an admin who cancels an
 * operation expects it to stop, and a handler that ignores it runs to
 * completion and then reports success against an operation the admin cancelled.
 *
 * These read the source rather than executing the handlers, because what is
 * being asserted is that the signal is consulted at all — a property of the
 * code, and one that a mocked run can satisfy without meaning anything.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const ADMIN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'src',
  'api',
  'handlers',
  'xrpc',
  'admin'
);

function source(name: string): string {
  return readFileSync(join(ADMIN_DIR, `${name}.ts`), 'utf8');
}

/** Handlers that start an operation and then do work in the background. */
const BACKGROUND_HANDLERS = [
  'triggerCitationExtraction',
  'triggerFreshnessScan',
  'triggerGovernanceSync',
  'triggerDIDSync',
];

describe('admin trigger handlers honour cancellation', () => {
  it.each(BACKGROUND_HANDLERS)('%s takes the abort signal', (name) => {
    expect(source(name)).toMatch(/const \{ operation, signal \}/);
  });

  it.each(BACKGROUND_HANDLERS)('%s actually reads the signal', (name) => {
    // Destructuring it and never checking it is the same bug wearing a
    // different shape.
    expect(source(name)).toMatch(/signal\.aborted/);
  });

  it('every handler that destructures an operation also takes the signal', () => {
    // Catches a new handler added in the old shape.
    const offenders = readdirSync(ADMIN_DIR)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => readFileSync(join(ADMIN_DIR, f), 'utf8').includes('const { operation }'));

    expect(offenders).toEqual([]);
  });
});

describe('triggerBackfill', () => {
  const contents = source('triggerBackfill');

  it('does not start an operation it has no way to run', () => {
    // It used to call startOperation and return, leaving an operation pending
    // forever: an admin saw a backfill start and never finish.
    expect(contents).not.toMatch(/backfillManager\.startOperation/);
  });

  it('names the endpoint that does the work instead', () => {
    expect(contents).toMatch(/pub\.chive\.admin\.triggerFullReindex/);
    expect(contents).toMatch(/pub\.chive\.admin\.triggerPDSScan/);
  });
});
