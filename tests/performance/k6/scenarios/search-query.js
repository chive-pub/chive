/**
 * k6 performance scenario: Search query performance.
 *
 * @description
 * Tests Elasticsearch search performance including:
 * - Simple text search
 * - Faceted search
 * - Autocomplete
 *
 * Target: p95 < 300ms for all search operations.
 *
 * Run with: k6 run scenarios/search-query.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend, Counter } from 'k6/metrics';

import { config, thresholds, stages, testData } from '../config.js';
import {
  makeRequest,
  validateJsonResponse,
  randomChoice,
  randomInt,
  generateSearchQuery,
  generateFacetedQuery,
  customMetrics,
} from '../lib/helpers.js';

/**
 * Custom metrics for search.
 */
const simpleSearchDuration = new Trend('simple_search_duration');
const facetedSearchDuration = new Trend('faceted_search_duration');
const autocompleteDuration = new Trend('autocomplete_duration');
const searchResultCount = new Counter('search_result_count');

/**
 * Test configuration.
 */
export const options = {
  scenarios: {
    // Simple search load
    simple_search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: stages.load,
      gracefulRampDown: '30s',
      exec: 'simpleSearchTest',
    },
    // Faceted search load (heavier queries)
    faceted_search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 30 },
        { duration: '5m', target: 30 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'facetedSearchTest',
      startTime: '9m', // After simple search
    },
    // Autocomplete (high frequency, low latency required)
    autocomplete: {
      executor: 'constant-arrival-rate',
      rate: 100, // 100 requests per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'autocompleteTest',
      startTime: '18m', // After faceted search
    },
  },
  thresholds: {
    ...thresholds.searchQuery,
    simple_search_duration: ['p(95)<300', 'p(99)<500'],
    faceted_search_duration: ['p(95)<500', 'p(99)<1000'],
    autocomplete_duration: ['p(95)<100', 'p(99)<200'],
  },
};

/**
 * Setup function.
 */
export function setup() {
  console.log(`Running search benchmark against ${config.baseUrl}`);

  // Warm up Elasticsearch cache
  for (const term of testData.searchTerms.slice(0, 3)) {
    makeRequest('GET', `${config.baseUrl}/xrpc/pub.chive.search.query?q=${encodeURIComponent(term)}&limit=10`);
  }

  return {
    baseUrl: config.baseUrl,
    startTime: Date.now(),
  };
}

/**
 * Simple text search test.
 */
export function simpleSearchTest(data) {
  const term = randomChoice(testData.searchTerms);
  const limit = randomChoice([10, 20, 50]);
  const offset = randomInt(0, 100);

  const queryParams = new URLSearchParams({
    q: term,
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const startTime = Date.now();
  const response = http.get(`${data.baseUrl}/xrpc/pub.chive.search.query?${queryParams}`, {
    headers: { Accept: 'application/json' },
    timeout: '10s',
  });
  const duration = Date.now() - startTime;

  // Track metrics
  simpleSearchDuration.add(duration);
  customMetrics.searchDuration.add(duration);

  // Validate response
  const valid = check(response, {
    'simple search: status is 200': (r) => r.status === 200,
    'simple search: duration < 300ms': () => duration < 300,
    'simple search: has hits array': (r) => {
      try {
        const json = r.json();
        return json && Array.isArray(json.hits);
      } catch {
        return false;
      }
    },
    'simple search: has total count': (r) => {
      try {
        const json = r.json();
        return json && typeof json.total === 'number';
      } catch {
        return false;
      }
    },
  });

  // Track result count
  if (valid) {
    try {
      const json = response.json();
      searchResultCount.add(json.hits?.length || 0);
    } catch {
      // Ignore parsing errors
    }
  }

  sleep(Math.random() * 0.3 + 0.1);
}

/**
 * Faceted search test.
 */
export function facetedSearchTest(data) {
  const term = randomChoice(testData.searchTerms);
  const subjectArea = randomChoice(testData.subjectAreas);
  const year = randomChoice(['2024', '2025', null]);

  const facetQuery = {
    q: term,
    limit: 20,
    facets: {
      subjectArea: [subjectArea],
      ...(year && { year: [year] }),
    },
    includeFacetCounts: true,
  };

  const startTime = Date.now();
  const response = makeRequest('POST', `${data.baseUrl}/xrpc/pub.chive.search.faceted`, facetQuery);
  const duration = Date.now() - startTime;

  // Track metrics
  facetedSearchDuration.add(duration);

  // Validate response
  check(response, {
    'faceted search: status is 200': (r) => r.status === 200,
    'faceted search: duration < 500ms': () => duration < 500,
    'faceted search: has hits': (r) => {
      try {
        const json = r.json();
        return json && Array.isArray(json.hits);
      } catch {
        return false;
      }
    },
    'faceted search: has facet counts': (r) => {
      try {
        const json = r.json();
        return json && json.facets && typeof json.facets === 'object';
      } catch {
        return false;
      }
    },
  });

  sleep(Math.random() * 0.5 + 0.2);
}

/**
 * Autocomplete test (high frequency).
 */
export function autocompleteTest(data) {
  // Simulate typing - progressively longer prefixes
  const term = randomChoice(testData.searchTerms);
  const prefixLength = randomInt(2, Math.min(term.length, 10));
  const prefix = term.substring(0, prefixLength);

  const startTime = Date.now();
  const response = http.get(`${data.baseUrl}/xrpc/pub.chive.search.autocomplete?q=${encodeURIComponent(prefix)}&limit=5`, {
    headers: { Accept: 'application/json' },
    timeout: '5s',
  });
  const duration = Date.now() - startTime;

  // Track metrics
  autocompleteDuration.add(duration);

  // Validate response - autocomplete must be fast
  check(response, {
    'autocomplete: status is 200': (r) => r.status === 200,
    'autocomplete: duration < 100ms': () => duration < 100,
    'autocomplete: has suggestions': (r) => {
      try {
        const json = r.json();
        return json && Array.isArray(json.suggestions || json);
      } catch {
        return false;
      }
    },
  });

  // Minimal sleep for autocomplete - simulates fast typing
  sleep(0.05);
}

/**
 * Default function.
 */
export default function (data) {
  simpleSearchTest(data);
}

/**
 * Teardown function.
 */
export function teardown(data) {
  const totalDuration = (Date.now() - data.startTime) / 1000;
  console.log(`Search benchmark completed in ${totalDuration.toFixed(2)}s`);
}
