/**
 * Unit tests for PrometheusMetrics.
 *
 * @remarks
 * Tests the PrometheusMetrics implementation of IMetrics interface.
 */

import { Registry } from 'prom-client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { PrometheusMetrics, createMetrics } from '../../../src/observability/metrics-exporter.js';

describe('PrometheusMetrics', () => {
  let registry: Registry;
  let metrics: PrometheusMetrics;

  beforeEach(() => {
    // Create fresh registry for each test to avoid metric conflicts
    registry = new Registry();
    metrics = new PrometheusMetrics({ registry, prefix: 'test_' });
  });

  afterEach(() => {
    // Clear registry
    registry.clear();
  });

  describe('constructor', () => {
    it('creates metrics with default options', () => {
      const defaultMetrics = new PrometheusMetrics();
      expect(defaultMetrics).toBeInstanceOf(PrometheusMetrics);
    });

    it('creates metrics with custom registry', () => {
      const customRegistry = new Registry();
      const customMetrics = new PrometheusMetrics({ registry: customRegistry });
      expect(customMetrics).toBeInstanceOf(PrometheusMetrics);
    });

    it('creates metrics with custom prefix', () => {
      const prefixedMetrics = new PrometheusMetrics({ registry, prefix: 'myapp_' });
      expect(prefixedMetrics).toBeInstanceOf(PrometheusMetrics);
    });

    it('creates metrics with custom buckets', () => {
      const bucketedMetrics = new PrometheusMetrics({
        registry,
        defaultBuckets: [0.1, 0.5, 1, 2, 5],
      });
      expect(bucketedMetrics).toBeInstanceOf(PrometheusMetrics);
    });
  });

  describe('IMetrics interface', () => {
    it('implements incrementCounter method', () => {
      expect(typeof metrics.incrementCounter).toBe('function');
    });

    it('implements setGauge method', () => {
      expect(typeof metrics.setGauge).toBe('function');
    });

    it('implements observeHistogram method', () => {
      expect(typeof metrics.observeHistogram).toBe('function');
    });

    it('implements startTimer method', () => {
      expect(typeof metrics.startTimer).toBe('function');
    });
  });

  describe('incrementCounter', () => {
    it('increments counter without labels', async () => {
      metrics.incrementCounter('requests_total');
      metrics.incrementCounter('requests_total');

      const output = await registry.metrics();
      expect(output).toContain('test_requests_total');
      expect(output).toContain('2');
    });

    it('increments counter with labels', async () => {
      metrics.incrementCounter('requests_total', { method: 'GET', status: '200' });
      metrics.incrementCounter('requests_total', { method: 'POST', status: '201' });

      const output = await registry.metrics();
      expect(output).toContain('test_requests_total');
      expect(output).toContain('method="GET"');
      expect(output).toContain('method="POST"');
    });

    it('increments counter by specific value', async () => {
      metrics.incrementCounter('bytes_total', {}, 1024);

      const output = await registry.metrics();
      expect(output).toContain('test_bytes_total');
      expect(output).toContain('1024');
    });

    it('creates counter with help text', async () => {
      metrics.incrementCounter('custom_counter');

      const output = await registry.metrics();
      expect(output).toContain('# HELP test_custom_counter');
      expect(output).toContain('# TYPE test_custom_counter counter');
    });

    it('does not double-prefix already prefixed metrics', async () => {
      metrics.incrementCounter('test_prefixed_counter');

      const output = await registry.metrics();
      expect(output).toContain('test_prefixed_counter');
      expect(output).not.toContain('test_test_prefixed_counter');
    });
  });

  describe('setGauge', () => {
    it('sets gauge without labels', async () => {
      metrics.setGauge('queue_size', 42);

      const output = await registry.metrics();
      expect(output).toContain('test_queue_size');
      expect(output).toContain('42');
    });

    it('sets gauge with labels', async () => {
      metrics.setGauge('queue_size', 10, { queue: 'indexing' });
      metrics.setGauge('queue_size', 20, { queue: 'processing' });

      const output = await registry.metrics();
      expect(output).toContain('queue="indexing"');
      expect(output).toContain('queue="processing"');
    });

    it('updates gauge value', async () => {
      metrics.setGauge('temperature', 20);
      metrics.setGauge('temperature', 25);

      const output = await registry.metrics();
      expect(output).toContain('test_temperature');
      expect(output).toContain('25');
    });

    it('creates gauge with help text', async () => {
      metrics.setGauge('custom_gauge', 1);

      const output = await registry.metrics();
      expect(output).toContain('# HELP test_custom_gauge');
      expect(output).toContain('# TYPE test_custom_gauge gauge');
    });
  });

  describe('observeHistogram', () => {
    it('observes histogram without labels', async () => {
      metrics.observeHistogram('duration_seconds', 0.5);

      const output = await registry.metrics();
      expect(output).toContain('test_duration_seconds_bucket');
      expect(output).toContain('test_duration_seconds_sum');
      expect(output).toContain('test_duration_seconds_count');
    });

    it('observes histogram with labels', async () => {
      metrics.observeHistogram('request_duration_seconds', 0.1, { method: 'GET' });
      metrics.observeHistogram('request_duration_seconds', 0.2, { method: 'POST' });

      const output = await registry.metrics();
      expect(output).toContain('method="GET"');
      expect(output).toContain('method="POST"');
    });

    it('records multiple observations', async () => {
      metrics.observeHistogram('latency_seconds', 0.05);
      metrics.observeHistogram('latency_seconds', 0.1);
      metrics.observeHistogram('latency_seconds', 0.5);

      const output = await registry.metrics();
      expect(output).toContain('test_latency_seconds_count 3');
    });

    it('creates histogram with help text', async () => {
      metrics.observeHistogram('custom_histogram', 1);

      const output = await registry.metrics();
      expect(output).toContain('# HELP test_custom_histogram');
      expect(output).toContain('# TYPE test_custom_histogram histogram');
    });

    it('uses default buckets', async () => {
      metrics.observeHistogram('bucketed_histogram', 0.05);

      const output = await registry.metrics();
      // Default buckets include 0.01, 0.05, 0.1, 0.5, 1, 5, 10
      expect(output).toContain('le="0.01"');
      expect(output).toContain('le="0.05"');
      expect(output).toContain('le="0.1"');
    });
  });

  describe('startTimer', () => {
    it('returns end function', () => {
      const endTimer = metrics.startTimer('operation_duration_seconds');
      expect(typeof endTimer).toBe('function');
    });

    it('records duration when end function is called', async () => {
      const endTimer = metrics.startTimer('operation_duration_seconds');

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      endTimer();

      const output = await registry.metrics();
      expect(output).toContain('test_operation_duration_seconds_count 1');
      expect(output).toContain('test_operation_duration_seconds_sum');
    });

    it('records duration with labels', async () => {
      const endTimer = metrics.startTimer('db_query_duration_seconds', {
        database: 'postgresql',
        operation: 'select',
      });

      endTimer();

      const output = await registry.metrics();
      expect(output).toContain('database="postgresql"');
      expect(output).toContain('operation="select"');
    });

    it('measures actual elapsed time', async () => {
      const endTimer = metrics.startTimer('precise_duration_seconds');

      // Wait approximately 50ms
      await new Promise((resolve) => setTimeout(resolve, 50));

      endTimer();

      const output = await registry.metrics();
      // Extract sum value (should be around 0.05 seconds)
      const sumMatch = /test_precise_duration_seconds_sum ([\d.]+)/.exec(output);
      expect(sumMatch).not.toBeNull();
      expect(sumMatch?.[1]).toBeDefined();
      const sum = parseFloat(sumMatch?.[1] ?? '');
      expect(sum).toBeGreaterThan(0.04);
      expect(sum).toBeLessThan(0.2);
    });
  });

  describe('metric type consistency', () => {
    it('throws error when using same name for different metric types', () => {
      metrics.incrementCounter('my_metric');

      expect(() => {
        metrics.setGauge('my_metric', 1);
      }).toThrow();
    });

    it('allows reusing same metric name for same type', async () => {
      metrics.incrementCounter('reused_counter');
      metrics.incrementCounter('reused_counter');

      const output = await registry.metrics();
      expect(output).toContain('test_reused_counter 2');
    });
  });

  describe('createMetrics factory', () => {
    it('creates PrometheusMetrics instance', () => {
      const factoryMetrics = createMetrics({ registry });
      expect(factoryMetrics).toBeDefined();
      expect(typeof factoryMetrics.incrementCounter).toBe('function');
    });

    it('accepts options', () => {
      const factoryMetrics = createMetrics({ registry, prefix: 'factory_' });
      expect(factoryMetrics).toBeDefined();
    });
  });

  describe('cardinality protection', () => {
    it('logs warning when cardinality limit is reached', () => {
      // Create metrics with low cardinality limit
      const lowCardMetrics = new PrometheusMetrics({
        registry,
        prefix: 'card_',
        maxCardinality: 5,
      });

      const consoleSpy = vi.spyOn(console, 'warn');

      // Create many unique label combinations
      for (let i = 0; i < 10; i++) {
        lowCardMetrics.incrementCounter('high_card_counter', { id: `${i}` });
      }

      // Should have warned about cardinality
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
