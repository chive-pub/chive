/**
 * k6 performance scenario: Preprint indexing.
 *
 * @description
 * Tests preprint indexing throughput and latency.
 * Target: p95 < 200ms for indexing operations.
 *
 * Run with: k6 run scenarios/preprint-indexing.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend, Counter } from 'k6/metrics';

import { config, thresholds, stages, testData } from '../config.js';
import {
  generateAtUri,
  generateCid,
  generatePreprint,
  makeRequest,
  validateResponse,
  randomChoice,
  customMetrics,
} from '../lib/helpers.js';

/**
 * Custom metrics for indexing.
 */
const indexDuration = new Trend('index_duration');
const indexSuccess = new Counter('index_success');
const indexFailure = new Counter('index_failure');

/**
 * Test configuration.
 */
export const options = {
  scenarios: {
    indexing_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: stages.load,
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    ...thresholds.preprintIndexing,
    index_duration: ['p(95)<200', 'p(99)<500'],
  },
};

/**
 * Setup function - runs once before all VUs.
 */
export function setup() {
  console.log(`Running preprint indexing benchmark against ${config.baseUrl}`);
  return {
    baseUrl: config.baseUrl,
    startTime: Date.now(),
  };
}

/**
 * Main test function - runs per VU iteration.
 */
export default function (data) {
  const authorDid = randomChoice(testData.sampleDIDs);
  const uri = generateAtUri(authorDid);
  const cid = generateCid();
  const preprint = generatePreprint(authorDid);

  // Simulate indexing request (POST to indexing endpoint)
  const indexPayload = {
    uri,
    cid,
    record: preprint,
    pdsUrl: 'https://pds.test.example.com',
  };

  const startTime = Date.now();
  const response = makeRequest('POST', `${data.baseUrl}/xrpc/pub.chive.index.preprint`, indexPayload);
  const duration = Date.now() - startTime;

  // Track metrics
  indexDuration.add(duration);
  customMetrics.indexingDuration.add(duration);

  // Validate response
  const success = check(response, {
    'indexing: status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'indexing: duration < 200ms': () => duration < 200,
    'indexing: response has uri': (r) => {
      try {
        const json = r.json();
        return json && json.uri;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    indexSuccess.add(1);
  } else {
    indexFailure.add(1);
  }

  // Optional: Verify indexed data is retrievable
  if (success && Math.random() < 0.1) {
    // 10% verification rate
    sleep(0.1); // Brief delay for indexing propagation

    const getResponse = makeRequest('GET', `${data.baseUrl}/xrpc/pub.chive.preprint.get?uri=${encodeURIComponent(uri)}`);

    check(getResponse, {
      'verification: preprint retrievable': (r) => r.status === 200,
      'verification: correct uri': (r) => {
        try {
          const json = r.json();
          return json && json.uri === uri;
        } catch {
          return false;
        }
      },
    });
  }

  // Think time between iterations
  sleep(Math.random() * 0.5 + 0.1);
}

/**
 * Teardown function - runs once after all VUs complete.
 */
export function teardown(data) {
  const totalDuration = (Date.now() - data.startTime) / 1000;
  console.log(`Preprint indexing benchmark completed in ${totalDuration.toFixed(2)}s`);
}
