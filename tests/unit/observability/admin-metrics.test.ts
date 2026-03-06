/**
 * Unit tests for new Prometheus metric groups.
 *
 * @remarks
 * Tests the metric groups added to prometheus-registry.ts: job metrics,
 * worker metrics, auth metrics, search metrics, blob proxy metrics,
 * DLQ metrics, admin action metrics, and backfill metrics.
 */

import { Counter, Histogram, Gauge } from 'prom-client';
import { describe, it, expect } from 'vitest';

import {
  prometheusRegistry,
  jobMetrics,
  workerMetrics,
  authMetrics,
  searchMetrics,
  blobProxyMetrics,
  dlqMetrics,
  adminMetrics,
  backfillMetrics,
  getMetrics,
} from '@/observability/prometheus-registry.js';

describe('Prometheus metric groups', () => {
  describe('jobMetrics', () => {
    it('has all expected metric keys', () => {
      expect(jobMetrics.executionsTotal).toBeDefined();
      expect(jobMetrics.duration).toBeDefined();
      expect(jobMetrics.lastRunTimestamp).toBeDefined();
      expect(jobMetrics.itemsProcessed).toBeDefined();
    });

    it('executionsTotal is a Counter with correct labels', () => {
      expect(jobMetrics.executionsTotal).toBeInstanceOf(Counter);
      // Verify we can increment with expected labels without error
      jobMetrics.executionsTotal.inc({ job: 'test_job', status: 'success' });
    });

    it('duration is a Histogram with correct labels', () => {
      expect(jobMetrics.duration).toBeInstanceOf(Histogram);
      jobMetrics.duration.observe({ job: 'test_job', status: 'success' }, 1.5);
    });

    it('lastRunTimestamp is a Gauge with job label', () => {
      expect(jobMetrics.lastRunTimestamp).toBeInstanceOf(Gauge);
      jobMetrics.lastRunTimestamp.set({ job: 'test_job' }, Date.now() / 1000);
    });

    it('itemsProcessed is a Counter with correct labels', () => {
      expect(jobMetrics.itemsProcessed).toBeInstanceOf(Counter);
      jobMetrics.itemsProcessed.inc({ job: 'test_job', status: 'success' }, 10);
    });
  });

  describe('workerMetrics', () => {
    it('has all expected metric keys', () => {
      expect(workerMetrics.tasksTotal).toBeDefined();
      expect(workerMetrics.taskDuration).toBeDefined();
      expect(workerMetrics.queueDepth).toBeDefined();
      expect(workerMetrics.activeCount).toBeDefined();
    });

    it('tasksTotal is a Counter with worker and status labels', () => {
      expect(workerMetrics.tasksTotal).toBeInstanceOf(Counter);
      workerMetrics.tasksTotal.inc({ worker: 'indexer', status: 'success' });
    });

    it('taskDuration is a Histogram with worker label', () => {
      expect(workerMetrics.taskDuration).toBeInstanceOf(Histogram);
      workerMetrics.taskDuration.observe({ worker: 'indexer' }, 0.25);
    });

    it('queueDepth is a Gauge with worker label', () => {
      expect(workerMetrics.queueDepth).toBeInstanceOf(Gauge);
      workerMetrics.queueDepth.set({ worker: 'indexer' }, 42);
    });

    it('activeCount is a Gauge with worker label', () => {
      expect(workerMetrics.activeCount).toBeInstanceOf(Gauge);
      workerMetrics.activeCount.set({ worker: 'indexer' }, 3);
    });
  });

  describe('authMetrics', () => {
    it('has all expected metric keys', () => {
      expect(authMetrics.attemptsTotal).toBeDefined();
      expect(authMetrics.duration).toBeDefined();
      expect(authMetrics.roleLookups).toBeDefined();
    });

    it('attemptsTotal is a Counter with method and result labels', () => {
      expect(authMetrics.attemptsTotal).toBeInstanceOf(Counter);
      authMetrics.attemptsTotal.inc({ method: 'service_auth', result: 'success' });
      authMetrics.attemptsTotal.inc({ method: 'service_auth', result: 'failure' });
      authMetrics.attemptsTotal.inc({ method: 'service_auth', result: 'anonymous' });
    });

    it('duration is a Histogram with method label', () => {
      expect(authMetrics.duration).toBeInstanceOf(Histogram);
      const endTimer = authMetrics.duration.startTimer({ method: 'service_auth' });
      endTimer();
    });

    it('roleLookups is a Counter with result label', () => {
      expect(authMetrics.roleLookups).toBeInstanceOf(Counter);
      authMetrics.roleLookups.inc({ result: 'cache_hit' });
      authMetrics.roleLookups.inc({ result: 'cache_miss' });
    });
  });

  describe('searchMetrics', () => {
    it('has all expected metric keys', () => {
      expect(searchMetrics.queriesTotal).toBeDefined();
      expect(searchMetrics.resultsTotal).toBeDefined();
      expect(searchMetrics.duration).toBeDefined();
    });

    it('queriesTotal is a Counter with type label', () => {
      expect(searchMetrics.queriesTotal).toBeInstanceOf(Counter);
      searchMetrics.queriesTotal.inc({ type: 'fulltext' });
    });

    it('resultsTotal is a Counter with type label', () => {
      expect(searchMetrics.resultsTotal).toBeInstanceOf(Counter);
      searchMetrics.resultsTotal.inc({ type: 'fulltext' }, 25);
    });

    it('duration is a Histogram with phase label', () => {
      expect(searchMetrics.duration).toBeInstanceOf(Histogram);
      searchMetrics.duration.observe({ phase: 'query' }, 0.15);
      searchMetrics.duration.observe({ phase: 'hydration' }, 0.05);
    });
  });

  describe('blobProxyMetrics', () => {
    it('has all expected metric keys', () => {
      expect(blobProxyMetrics.requestsTotal).toBeDefined();
      expect(blobProxyMetrics.bytesTotal).toBeDefined();
      expect(blobProxyMetrics.duration).toBeDefined();
    });

    it('requestsTotal is a Counter with status and cache labels', () => {
      expect(blobProxyMetrics.requestsTotal).toBeInstanceOf(Counter);
      blobProxyMetrics.requestsTotal.inc({ status: 'success', cache: 'redis' });
      blobProxyMetrics.requestsTotal.inc({ status: 'success', cache: 'cdn' });
      blobProxyMetrics.requestsTotal.inc({ status: 'success', cache: 'pds' });
      blobProxyMetrics.requestsTotal.inc({ status: 'error', cache: 'none' });
    });

    it('bytesTotal is a Counter with direction label', () => {
      expect(blobProxyMetrics.bytesTotal).toBeInstanceOf(Counter);
      blobProxyMetrics.bytesTotal.inc({ direction: 'out' }, 1024);
      blobProxyMetrics.bytesTotal.inc({ direction: 'in' }, 2048);
    });

    it('duration is a Histogram without labels', () => {
      expect(blobProxyMetrics.duration).toBeInstanceOf(Histogram);
      blobProxyMetrics.duration.observe(0.5);
    });
  });

  describe('dlqMetrics', () => {
    it('has all expected metric keys', () => {
      expect(dlqMetrics.entriesTotal).toBeDefined();
      expect(dlqMetrics.retriesTotal).toBeDefined();
    });

    it('entriesTotal is a Gauge without labels', () => {
      expect(dlqMetrics.entriesTotal).toBeInstanceOf(Gauge);
      dlqMetrics.entriesTotal.set(5);
    });

    it('retriesTotal is a Counter with status label', () => {
      expect(dlqMetrics.retriesTotal).toBeInstanceOf(Counter);
      dlqMetrics.retriesTotal.inc({ status: 'success' });
      dlqMetrics.retriesTotal.inc({ status: 'failure' });
    });
  });

  describe('adminMetrics', () => {
    it('has all expected metric keys', () => {
      expect(adminMetrics.actionsTotal).toBeDefined();
    });

    it('actionsTotal is a Counter with action and target labels', () => {
      expect(adminMetrics.actionsTotal).toBeInstanceOf(Counter);
      adminMetrics.actionsTotal.inc({ action: 'delete', target: 'eprint' });
      adminMetrics.actionsTotal.inc({ action: 'ban', target: 'user' });
    });
  });

  describe('backfillMetrics', () => {
    it('has all expected metric keys', () => {
      expect(backfillMetrics.operationsTotal).toBeDefined();
      expect(backfillMetrics.recordsProcessed).toBeDefined();
      expect(backfillMetrics.duration).toBeDefined();
    });

    it('operationsTotal is a Counter with type and status labels', () => {
      expect(backfillMetrics.operationsTotal).toBeInstanceOf(Counter);
      backfillMetrics.operationsTotal.inc({ type: 'full', status: 'success' });
    });

    it('recordsProcessed is a Counter with type label', () => {
      expect(backfillMetrics.recordsProcessed).toBeInstanceOf(Counter);
      backfillMetrics.recordsProcessed.inc({ type: 'eprint' }, 100);
    });

    it('duration is a Histogram with type label', () => {
      expect(backfillMetrics.duration).toBeInstanceOf(Histogram);
      backfillMetrics.duration.observe({ type: 'full' }, 120);
    });
  });

  describe('registry integration', () => {
    it('all new metrics are registered in the shared registry', async () => {
      const output = await prometheusRegistry.metrics();

      // Job metrics
      expect(output).toContain('chive_job_executions_total');
      expect(output).toContain('chive_job_duration_seconds');
      expect(output).toContain('chive_job_last_run_timestamp');
      expect(output).toContain('chive_job_items_processed_total');

      // Worker metrics
      expect(output).toContain('chive_worker_tasks_total');
      expect(output).toContain('chive_worker_task_duration_seconds');
      expect(output).toContain('chive_worker_queue_depth');
      expect(output).toContain('chive_worker_active_count');

      // Auth metrics
      expect(output).toContain('chive_auth_attempts_total');
      expect(output).toContain('chive_auth_duration_seconds');
      expect(output).toContain('chive_role_lookups_total');

      // Search metrics
      expect(output).toContain('chive_search_queries_total');
      expect(output).toContain('chive_search_results_total');
      expect(output).toContain('chive_search_duration_seconds');

      // Blob proxy metrics
      expect(output).toContain('chive_blob_proxy_requests_total');
      expect(output).toContain('chive_blob_proxy_bytes_total');
      expect(output).toContain('chive_blob_proxy_duration_seconds');

      // DLQ metrics
      expect(output).toContain('chive_dlq_entries_total');
      expect(output).toContain('chive_dlq_retries_total');

      // Admin metrics
      expect(output).toContain('chive_admin_actions_total');

      // Backfill metrics
      expect(output).toContain('chive_backfill_operations_total');
      expect(output).toContain('chive_backfill_records_processed');
      expect(output).toContain('chive_backfill_duration_seconds');
    });

    it('getMetrics returns string containing all new metric groups', async () => {
      const output = await getMetrics();

      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);

      // Spot-check presence of new metrics in the aggregated output
      expect(output).toContain('chive_auth_attempts_total');
      expect(output).toContain('chive_blob_proxy_requests_total');
      expect(output).toContain('chive_admin_actions_total');
    });

    it('metrics have correct Prometheus TYPE annotations', async () => {
      const output = await prometheusRegistry.metrics();

      // Counters
      expect(output).toContain('# TYPE chive_job_executions_total counter');
      expect(output).toContain('# TYPE chive_worker_tasks_total counter');
      expect(output).toContain('# TYPE chive_auth_attempts_total counter');
      expect(output).toContain('# TYPE chive_blob_proxy_requests_total counter');
      expect(output).toContain('# TYPE chive_dlq_retries_total counter');
      expect(output).toContain('# TYPE chive_admin_actions_total counter');
      expect(output).toContain('# TYPE chive_backfill_operations_total counter');

      // Histograms
      expect(output).toContain('# TYPE chive_job_duration_seconds histogram');
      expect(output).toContain('# TYPE chive_worker_task_duration_seconds histogram');
      expect(output).toContain('# TYPE chive_auth_duration_seconds histogram');
      expect(output).toContain('# TYPE chive_search_duration_seconds histogram');
      expect(output).toContain('# TYPE chive_blob_proxy_duration_seconds histogram');
      expect(output).toContain('# TYPE chive_backfill_duration_seconds histogram');

      // Gauges
      expect(output).toContain('# TYPE chive_job_last_run_timestamp gauge');
      expect(output).toContain('# TYPE chive_worker_queue_depth gauge');
      expect(output).toContain('# TYPE chive_worker_active_count gauge');
      expect(output).toContain('# TYPE chive_dlq_entries_total gauge');
    });

    it('metrics have HELP annotations', async () => {
      const output = await prometheusRegistry.metrics();

      expect(output).toContain('# HELP chive_job_executions_total Total job executions');
      expect(output).toContain('# HELP chive_worker_tasks_total Total worker tasks processed');
      expect(output).toContain('# HELP chive_auth_attempts_total Total authentication attempts');
      expect(output).toContain('# HELP chive_blob_proxy_requests_total Total blob proxy requests');
      expect(output).toContain('# HELP chive_dlq_entries_total Current DLQ entry count');
      expect(output).toContain('# HELP chive_admin_actions_total Total admin actions');
      expect(output).toContain('# HELP chive_backfill_operations_total Total backfill operations');
    });
  });
});
