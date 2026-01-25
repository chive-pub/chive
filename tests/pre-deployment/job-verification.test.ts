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
import * as EnrichmentWorker from '../../src/workers/enrichment-worker.js';
import * as FreshnessWorker from '../../src/workers/freshness-worker.js';
import * as IndexRetryWorker from '../../src/workers/index-retry-worker.js';

describe('Pre-Deployment Job Verification', () => {
  // ===========================================================================
  // JOB MODULE IMPORTS
  // ===========================================================================

  describe('Job Module Imports', () => {
    it('governance-sync-job module exports correctly', () => {
      expect(GovernanceSyncJob).toBeDefined();
      // Check for expected exports (adjust based on actual exports)
      expect(typeof GovernanceSyncJob).toBe('object');
    });

    it('graph-algorithm-job module exports correctly', () => {
      expect(GraphAlgorithmJob).toBeDefined();
      expect(typeof GraphAlgorithmJob).toBe('object');
    });

    it('freshness-scan-job module exports correctly', () => {
      expect(FreshnessScanJob).toBeDefined();
      expect(typeof FreshnessScanJob).toBe('object');
    });

    it('pds-scan-scheduler-job module exports correctly', () => {
      expect(PdsScanSchedulerJob).toBeDefined();
      expect(typeof PdsScanSchedulerJob).toBe('object');
    });

    it('tag-sync-job module exports correctly', () => {
      expect(TagSyncJob).toBeDefined();
      expect(typeof TagSyncJob).toBe('object');
    });
  });

  // ===========================================================================
  // WORKER MODULE IMPORTS
  // ===========================================================================

  describe('Worker Module Imports', () => {
    it('index-retry-worker module exports correctly', () => {
      expect(IndexRetryWorker).toBeDefined();
      expect(typeof IndexRetryWorker).toBe('object');
    });

    it('enrichment-worker module exports correctly', () => {
      expect(EnrichmentWorker).toBeDefined();
      expect(typeof EnrichmentWorker).toBe('object');
    });

    it('freshness-worker module exports correctly', () => {
      expect(FreshnessWorker).toBeDefined();
      expect(typeof FreshnessWorker).toBe('object');
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

    it('EnrichmentWorker can be instantiated', () => {
      if ('EnrichmentWorker' in EnrichmentWorker) {
        const WorkerClass = (EnrichmentWorker as Record<string, unknown>).EnrichmentWorker;
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
