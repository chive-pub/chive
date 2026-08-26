/**
 * Unit tests for cancellation of long-running admin operations.
 *
 * @remarks
 * `backfillManager.startOperation` returns `{ operation, signal }`. Every
 * trigger handler destructured `{ operation }` alone and dropped the signal, so
 * `admin.cancelBackfill` flipped the operation's state in Redis while the loop
 * it was meant to stop ran to completion — a cancel that reported success and
 * cancelled nothing. On a full reindex that is the difference between stopping
 * a bad run and waiting out the entire index.
 *
 * These tests assert the source destructures the signal and guards its loops.
 * The loops run inside a fire-and-forget async closure that the handler does
 * not await, so observing the abort behaviourally from a unit test would race;
 * pinning the wiring is what keeps the signal from being dropped again.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const HANDLER_DIR = 'src/api/handlers/xrpc/admin';

const source = (handler: string): string =>
  readFileSync(join(process.cwd(), HANDLER_DIR, `${handler}.ts`), 'utf8');

/** Handlers that drive a loop locally and must therefore honour the signal. */
const LOOPING_HANDLERS = [
  'triggerFullReindex',
  'triggerCitationExtraction',
  'triggerPDSScan',
  'triggerFreshnessScan',
];

/** Handlers that delegate the work to a service and have no local loop. */
const DELEGATING_HANDLERS = ['triggerBackfill', 'triggerDIDSync', 'triggerGovernanceSync'];

describe('admin operations honour cancellation', () => {
  it.each(LOOPING_HANDLERS)('%s takes the abort signal from startOperation', (handler) => {
    expect(source(handler)).toMatch(/const \{ operation, signal \} = await backfillManager/);
  });

  it.each(LOOPING_HANDLERS)('%s checks the signal inside its loop', (handler) => {
    expect(source(handler)).toMatch(/if \(signal\.aborted\)/);
  });

  // Every loop needs its own guard: a reindex collects URIs in one loop and
  // processes them in another, and cancelling during collection has to stop
  // there rather than proceed to process everything collected so far.
  it('guards both the collection and the processing loop of a full reindex', () => {
    const contents = source('triggerFullReindex');
    expect([...contents.matchAll(/if \(signal\.aborted\)/g)]).toHaveLength(2);
  });

  it('guards both loops of citation extraction', () => {
    const contents = source('triggerCitationExtraction');
    expect([...contents.matchAll(/if \(signal\.aborted\)/g)]).toHaveLength(2);
  });

  // Recorded so that adding a local loop to one of these is a deliberate act
  // that has to update this list rather than silently reintroducing the bug.
  it.each(DELEGATING_HANDLERS)('%s has no local loop to cancel', (handler) => {
    const contents = source(handler);
    expect(contents).not.toMatch(/^\s+(for|while) \(/m);
  });
});
