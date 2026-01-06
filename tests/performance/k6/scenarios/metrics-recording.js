/**
 * k6 performance scenario: Metrics recording.
 *
 * @description
 * Tests MetricsService Redis performance:
 * - View recording (INCR + PFADD + ZADD)
 * - Download recording
 * - Batch operations (Redis pipelines)
 * - Trending queries
 *
 * Target: p95 < 10ms for individual operations.
 *
 * Run with: k6 run scenarios/metrics-recording.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend, Counter, Rate } from 'k6/metrics';

import { config, thresholds, stages, testData } from '../config.js';
import {
  generateAtUri,
  makeRequest,
  randomChoice,
  randomInt,
  createBatchOperations,
  customMetrics,
} from '../lib/helpers.js';

/**
 * Custom metrics for metrics recording.
 */
const viewRecordDuration = new Trend('view_record_duration');
const downloadRecordDuration = new Trend('download_record_duration');
const batchRecordDuration = new Trend('batch_record_duration');
const trendingQueryDuration = new Trend('trending_query_duration');
const operationsPerSecond = new Counter('operations_per_second');
const operationSuccessRate = new Rate('operation_success_rate');

/**
 * Pre-generated URIs for testing.
 */
const testURIs = testData.sampleDIDs.flatMap((did) =>
  Array.from({ length: 20 }, (_, i) => `at://${did}/pub.chive.preprint.submission/perf${i}`)
);

/**
 * Test configuration.
 */
export const options = {
  scenarios: {
    // High-throughput view recording
    view_recording: {
      executor: 'constant-arrival-rate',
      rate: 1000, // 1000 requests per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      exec: 'recordViewTest',
    },
    // Download recording (lower volume)
    download_recording: {
      executor: 'constant-arrival-rate',
      rate: 100, // 100 requests per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: 'recordDownloadTest',
      startTime: '3m',
    },
    // Batch operations (pipeline efficiency)
    batch_recording: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      exec: 'batchRecordTest',
      startTime: '6m',
    },
    // Trending queries (read operations)
    trending_queries: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      exec: 'trendingQueryTest',
      startTime: '10m',
    },
  },
  thresholds: {
    ...thresholds.metricsRecording,
    view_record_duration: ['p(95)<10', 'p(99)<50'],
    download_record_duration: ['p(95)<10', 'p(99)<50'],
    batch_record_duration: ['p(95)<50', 'p(99)<100'],
    trending_query_duration: ['p(95)<100', 'p(99)<200'],
    operation_success_rate: ['rate>0.99'],
  },
};

/**
 * Setup function.
 */
export function setup() {
  console.log(`Running metrics recording benchmark against ${config.baseUrl}`);
  console.log(`Testing with ${testURIs.length} preprint URIs`);

  return {
    baseUrl: config.baseUrl,
    startTime: Date.now(),
  };
}

/**
 * Record view test - high throughput.
 */
export function recordViewTest(data) {
  const uri = randomChoice(testURIs);
  const viewerDid = randomChoice(testData.sampleDIDs);

  const payload = {
    uri,
    viewerDid,
  };

  const startTime = Date.now();
  const response = makeRequest('POST', `${data.baseUrl}/xrpc/pub.chive.metrics.recordView`, payload);
  const duration = Date.now() - startTime;

  // Track metrics
  viewRecordDuration.add(duration);
  customMetrics.metricsRecordDuration.add(duration);
  operationsPerSecond.add(1);

  // Validate
  const success = check(response, {
    'view record: status is 200': (r) => r.status === 200,
    'view record: duration < 10ms': () => duration < 10,
  });

  operationSuccessRate.add(success ? 1 : 0);
}

/**
 * Record download test.
 */
export function recordDownloadTest(data) {
  const uri = randomChoice(testURIs);
  const viewerDid = randomChoice(testData.sampleDIDs);

  const payload = {
    uri,
    viewerDid,
  };

  const startTime = Date.now();
  const response = makeRequest('POST', `${data.baseUrl}/xrpc/pub.chive.metrics.recordDownload`, payload);
  const duration = Date.now() - startTime;

  // Track metrics
  downloadRecordDuration.add(duration);
  operationsPerSecond.add(1);

  // Validate
  const success = check(response, {
    'download record: status is 200': (r) => r.status === 200,
    'download record: duration < 10ms': () => duration < 10,
  });

  operationSuccessRate.add(success ? 1 : 0);
}

/**
 * Batch record test - pipeline operations.
 */
export function batchRecordTest(data) {
  const batchSize = randomChoice([10, 25, 50, 100]);
  const operations = createBatchOperations(batchSize, 'view', testURIs, testData.sampleDIDs);

  const payload = {
    operations,
  };

  const startTime = Date.now();
  const response = makeRequest('POST', `${data.baseUrl}/xrpc/pub.chive.metrics.batchRecord`, payload);
  const duration = Date.now() - startTime;

  // Track metrics
  batchRecordDuration.add(duration);
  operationsPerSecond.add(batchSize);

  // Calculate per-operation time
  const perOpDuration = duration / batchSize;

  // Validate
  const success = check(response, {
    'batch record: status is 200': (r) => r.status === 200,
    'batch record: duration < 100ms': () => duration < 100,
    'batch record: per-op < 5ms': () => perOpDuration < 5,
  });

  operationSuccessRate.add(success ? 1 : 0);

  sleep(Math.random() * 0.2 + 0.1);
}

/**
 * Trending query test.
 */
export function trendingQueryTest(data) {
  const window = randomChoice(['24h', '7d', '30d']);
  const limit = randomChoice([10, 20, 50]);

  const queryParams = new URLSearchParams({
    window,
    limit: limit.toString(),
  });

  const startTime = Date.now();
  const response = http.get(`${data.baseUrl}/xrpc/pub.chive.metrics.trending?${queryParams}`, {
    headers: { Accept: 'application/json' },
    timeout: '5s',
  });
  const duration = Date.now() - startTime;

  // Track metrics
  trendingQueryDuration.add(duration);

  // Validate
  check(response, {
    'trending: status is 200': (r) => r.status === 200,
    'trending: duration < 100ms': () => duration < 100,
    'trending: has results array': (r) => {
      try {
        const json = r.json();
        return json && Array.isArray(json.trending || json);
      } catch {
        return false;
      }
    },
    'trending: results sorted by score': (r) => {
      try {
        const json = r.json();
        const results = json.trending || json;
        if (!Array.isArray(results) || results.length < 2) return true;
        for (let i = 1; i < results.length; i++) {
          if (results[i].score > results[i - 1].score) return false;
        }
        return true;
      } catch {
        return false;
      }
    },
  });

  sleep(Math.random() * 0.5 + 0.2);
}

/**
 * Default function.
 */
export default function (data) {
  recordViewTest(data);
}

/**
 * Teardown function.
 */
export function teardown(data) {
  const totalDuration = (Date.now() - data.startTime) / 1000;
  console.log(`Metrics recording benchmark completed in ${totalDuration.toFixed(2)}s`);
}
