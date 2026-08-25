/**
 * Unit tests for deletion handling in the freshness worker.
 *
 * @remarks
 * When a freshness check found a record gone from its PDS, the worker emitted
 * `record.deletion_detected` and returned `deleted: true`. No subscriber to
 * that event was ever written, so the record stayed in the index indefinitely:
 * the scan reported a successful deletion detection and deleted nothing. The
 * source comment admitted the handler was still to be written.
 *
 * `PDSSyncService.markAsDeleted` was on this worker's own dependencies the
 * whole time. The event is still emitted, for plugins that want to observe it,
 * but it is no longer what performs the deletion.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/workers/freshness-worker.ts'), 'utf8');

describe('freshness worker deletion', () => {
  it('marks the record deleted through the sync service', () => {
    expect(source).toMatch(/await this\.syncService\.markAsDeleted\(uri, source\)/);
  });

  it('awaits the deletion before reporting the job result', () => {
    expect(source).toMatch(/await this\.markAsDeleted\(uri, 'pds_404'\)/);
  });

  it('logs when the deletion itself fails', () => {
    expect(source).toMatch(/Failed to mark record as deleted/);
  });

  // Kept so plugins can observe deletions; it is no longer load-bearing.
  it('still emits the detection event', () => {
    expect(source).toMatch(/record\.deletion_detected/);
  });

  // The comment that described the missing handler should not outlive it.
  it('no longer claims a handler will do the work', () => {
    expect(source).not.toMatch(/For now, emit event for handler to process/);
  });
});
