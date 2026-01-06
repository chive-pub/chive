/**
 * k6 performance scenario: Blob proxy load testing.
 *
 * @description
 * Tests the 3-tier blob cache (L1: Redis, L2: CDN, L3: PDS).
 * Targets:
 * - L1 cache hit: p95 < 50ms
 * - L2/L3 fallback: p95 < 200ms
 *
 * Run with: k6 run scenarios/blob-proxy-load.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend, Rate, Counter } from 'k6/metrics';

import { config, thresholds, stages, testData } from '../config.js';
import {
  generateCid,
  makeRequest,
  randomChoice,
  randomInt,
  trackCacheMetrics,
} from '../lib/helpers.js';

/**
 * Custom metrics for blob proxy.
 */
const blobFetchDuration = new Trend('blob_fetch_duration');
const cacheHitRate = new Rate('cache_hit_rate');
const cacheHitDuration = new Trend('cache_hit_duration');
const cacheMissDuration = new Trend('cache_miss_duration');
const blobBytesDownloaded = new Counter('blob_bytes_downloaded');

/**
 * Test configuration.
 */
export const options = {
  scenarios: {
    // Warm cache scenario - repeated requests to same CIDs
    warm_cache: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'warmCacheTest',
    },
    // Cold cache scenario - unique CIDs each time
    cold_cache: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '2m', target: 20 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'coldCacheTest',
      startTime: '5m', // Start after warm cache test
    },
    // Concurrent requests for same blob (coalescing test)
    coalescing: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      maxDuration: '30s',
      exec: 'coalescingTest',
      startTime: '9m',
    },
  },
  thresholds: {
    cache_hit_duration: ['p(95)<50', 'p(99)<100'],
    cache_miss_duration: ['p(95)<200', 'p(99)<500'],
    cache_hit_rate: ['rate>0.7'], // Expect 70%+ cache hit rate for warm cache
    http_req_failed: ['rate<0.01'],
  },
};

/**
 * Shared test data between scenarios.
 */
const sharedData = {
  warmCacheCIDs: testData.sampleCIDs,
  warmCacheDID: testData.sampleDIDs[0],
};

/**
 * Setup function.
 */
export function setup() {
  console.log(`Running blob proxy benchmark against ${config.baseUrl}`);

  // Pre-warm cache with sample CIDs
  for (const cid of sharedData.warmCacheCIDs) {
    makeRequest('GET', `${config.baseUrl}/blob/${sharedData.warmCacheDID}/${cid}`);
  }

  return {
    baseUrl: config.baseUrl,
    startTime: Date.now(),
  };
}

/**
 * Warm cache test - requests to pre-cached blobs.
 */
export function warmCacheTest(data) {
  const did = sharedData.warmCacheDID;
  const cid = randomChoice(sharedData.warmCacheCIDs);

  const startTime = Date.now();
  const response = http.get(`${data.baseUrl}/blob/${did}/${cid}`, {
    headers: { Accept: '*/*' },
    timeout: '10s',
  });
  const duration = Date.now() - startTime;

  // Track metrics
  blobFetchDuration.add(duration);

  // Determine cache hit from headers
  const cacheHeader = response.headers['X-Cache-Status'] || response.headers['x-cache-status'];
  const isCacheHit = cacheHeader === 'HIT' || cacheHeader === 'L1-HIT' || duration < 50;

  cacheHitRate.add(isCacheHit ? 1 : 0);
  if (isCacheHit) {
    cacheHitDuration.add(duration);
  } else {
    cacheMissDuration.add(duration);
  }

  // Track bytes
  if (response.body) {
    blobBytesDownloaded.add(response.body.length);
  }

  // Validate response
  check(response, {
    'warm cache: status is 200': (r) => r.status === 200,
    'warm cache: has content-type': (r) => r.headers['Content-Type'] !== undefined,
    'warm cache: has body': (r) => r.body && r.body.length > 0,
    'warm cache: duration < 100ms': () => duration < 100,
  });

  sleep(Math.random() * 0.2 + 0.05);
}

/**
 * Cold cache test - requests to unique blobs (cache miss expected).
 */
export function coldCacheTest(data) {
  const did = randomChoice(testData.sampleDIDs);
  const cid = generateCid(); // Unique CID each time

  const startTime = Date.now();
  const response = http.get(`${data.baseUrl}/blob/${did}/${cid}`, {
    headers: { Accept: '*/*' },
    timeout: '30s',
  });
  const duration = Date.now() - startTime;

  // Track metrics (expect cache miss)
  blobFetchDuration.add(duration);
  cacheHitRate.add(0);
  cacheMissDuration.add(duration);

  // Validate response
  check(response, {
    'cold cache: status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'cold cache: duration < 500ms': () => duration < 500,
  });

  sleep(Math.random() * 0.5 + 0.2);
}

/**
 * Request coalescing test - many concurrent requests for same blob.
 */
export function coalescingTest(data) {
  // All VUs request the same blob simultaneously
  const did = sharedData.warmCacheDID;
  const cid = 'bafycoalesce123'; // Fixed CID for coalescing test

  const startTime = Date.now();
  const response = http.get(`${data.baseUrl}/blob/${did}/${cid}`, {
    headers: { Accept: '*/*' },
    timeout: '30s',
  });
  const duration = Date.now() - startTime;

  blobFetchDuration.add(duration);

  // With proper coalescing, only one actual PDS fetch should occur
  // All 100 VUs should complete in similar time
  check(response, {
    'coalescing: status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'coalescing: duration < 1000ms': () => duration < 1000,
  });
}

/**
 * Default function for simple execution.
 */
export default function (data) {
  warmCacheTest(data);
}

/**
 * Teardown function.
 */
export function teardown(data) {
  const totalDuration = (Date.now() - data.startTime) / 1000;
  console.log(`Blob proxy benchmark completed in ${totalDuration.toFixed(2)}s`);
}
