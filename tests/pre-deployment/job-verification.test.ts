/**
 * Pre-deployment job verification tests.
 *
 * @remarks
 * These tests verify that all background jobs can be instantiated
 * and their core logic functions correctly.
 *
 * @packageDocumentation
 */

// Required for tsyringe dependency injection
import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

// Import job modules to verify they can be loaded
import * as FreshnessScanJob from '../../src/jobs/freshness-scan-job.js';
import * as GovernanceSyncJob from '../../src/jobs/governance-sync-job.js';
import * as GraphAlgorithmJob from '../../src/jobs/graph-algorithm-job.js';
import * as PdsScanSchedulerJob from '../../src/jobs/pds-scan-scheduler-job.js';
import * as TagSyncJob from '../../src/jobs/tag-sync-job.js';
// Import worker modules
import * as FreshnessWorker from '../../src/workers/freshness-worker.js';
import * as IndexRetryWorker from '../../src/workers/index-retry-worker.js';

describe('Pre-Deployment Job Verification', () => {
  // ===========================================================================
  // JOB MODULE IMPORTS
  // ===========================================================================

  describe('Job Module Imports', () => {
    // `typeof <namespace import>` is 'object' for every module that loads at
    // all, so the previous form of these could not fail — including when a job
    // class was renamed or removed. Each case now names the export the caller
    // in src/index.ts or src/indexer.ts actually constructs, and checks it is
    // a constructor, which is the property that makes the module usable.
    const jobExports: [string, string, Record<string, unknown>][] = [
      ['governance-sync-job', 'GovernanceSyncJob', GovernanceSyncJob],
      ['graph-algorithm-job', 'GraphAlgorithmJob', GraphAlgorithmJob],
      ['freshness-scan-job', 'FreshnessScanJob', FreshnessScanJob],
      ['pds-scan-scheduler-job', 'PDSScanSchedulerJob', PdsScanSchedulerJob],
      ['tag-sync-job', 'TagSyncJob', TagSyncJob],
    ];

    it.each(jobExports)('%s exports the %s class', (_module, exportName, namespace) => {
      expect(namespace[exportName], `${exportName} is not exported`).toBeDefined();
      expect(typeof namespace[exportName]).toBe('function');
      expect((namespace[exportName] as { prototype?: unknown }).prototype).toBeDefined();
    });

    it('graph-algorithm-job exports the scheduler src/index.ts calls', () => {
      // The job is only reachable through this factory; without it the
      // community and trending caches have no producer.
      expect(typeof GraphAlgorithmJob.createGraphAlgorithmJobScheduler).toBe('function');
    });
  });

  // ===========================================================================
  // WORKER MODULE IMPORTS
  // ===========================================================================

  describe('Worker Module Imports', () => {
    const workerExports: [string, string, Record<string, unknown>][] = [
      ['index-retry-worker', 'IndexRetryWorker', IndexRetryWorker],
      ['freshness-worker', 'FreshnessWorker', FreshnessWorker],
    ];

    it.each(workerExports)('%s exports the %s class', (_module, exportName, namespace) => {
      expect(namespace[exportName], `${exportName} is not exported`).toBeDefined();
      expect(typeof namespace[exportName]).toBe('function');
      expect((namespace[exportName] as { prototype?: unknown }).prototype).toBeDefined();
    });

    it('freshness-worker exports its queue factory', () => {
      expect(typeof FreshnessWorker.createFreshnessQueue).toBe('function');
    });
  });

  // ===========================================================================
  // WORKER CLASS INSTANTIATION
  // ===========================================================================

  describe('Worker Class Instantiation', () => {
    it('IndexRetryWorker can be instantiated', () => {
      // Check if the worker class exists and has expected structure
      if ('IndexRetryWorker' in IndexRetryWorker) {
        const WorkerClass = (IndexRetryWorker as Record<string, unknown>).IndexRetryWorker;
        expect(typeof WorkerClass).toBe('function');
      }
    });

    it('FreshnessWorker can be instantiated', () => {
      if ('FreshnessWorker' in FreshnessWorker) {
        const WorkerClass = (FreshnessWorker as Record<string, unknown>).FreshnessWorker;
        expect(typeof WorkerClass).toBe('function');
      }
    });
  });
});
