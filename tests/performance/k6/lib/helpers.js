/**
 * k6 helper utilities for performance benchmarks.
 *
 * @description
 * Shared utility functions for generating test data, making requests,
 * and validating responses across k6 scenarios.
 */

import { check } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

/**
 * Custom metrics for detailed tracking.
 */
export const customMetrics = {
  cacheHitRate: new Rate('cache_hit_rate'),
  cacheHitDuration: new Trend('cache_hit_duration'),
  cacheMissDuration: new Trend('cache_miss_duration'),
  indexingDuration: new Trend('indexing_duration'),
  searchDuration: new Trend('search_duration'),
  metricsRecordDuration: new Trend('metrics_record_duration'),
};

/**
 * Generates a random AT-URI for testing.
 *
 * @param {string} did - DID of the author
 * @param {string} collection - Lexicon collection name
 * @returns {string} AT-URI string
 */
export function generateAtUri(did, collection = 'pub.chive.preprint.submission') {
  const rkey = `perf${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
  return `at://${did}/${collection}/${rkey}`;
}

/**
 * Generates a random CID for testing.
 *
 * @returns {string} CID string
 */
export function generateCid() {
  const suffix = Math.random().toString(36).substring(2, 15);
  return `bafyrei${suffix}${Date.now().toString(36)}`;
}

/**
 * Generates test preprint data.
 *
 * @param {string} did - Author DID
 * @returns {object} Preprint submission object
 */
export function generatePreprint(did) {
  const timestamp = Date.now();
  return {
    $type: 'pub.chive.preprint.submission',
    author: did,
    title: `Performance Test Preprint ${timestamp}`,
    abstract: `This is a test abstract for performance benchmarking. Timestamp: ${timestamp}`,
    keywords: ['performance', 'test', 'benchmark'],
    facets: [],
    pdfBlobRef: {
      $type: 'blob',
      ref: generateCid(),
      mimeType: 'application/pdf',
      size: 1024000 + Math.floor(Math.random() * 5000000),
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Makes an authenticated request with standard headers.
 *
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {object|string} body - Request body
 * @param {object} headers - Additional headers
 * @returns {object} k6 Response object
 */
export function makeRequest(method, url, body = null, headers = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'k6-performance-test',
  };

  const params = {
    headers: { ...defaultHeaders, ...headers },
    timeout: '30s',
  };

  const payload = body ? JSON.stringify(body) : null;

  switch (method.toUpperCase()) {
    case 'GET':
      return http.get(url, params);
    case 'POST':
      return http.post(url, payload, params);
    case 'PUT':
      return http.put(url, payload, params);
    case 'DELETE':
      return http.del(url, payload, params);
    default:
      return http.request(method, url, payload, params);
  }
}

/**
 * Validates common response expectations.
 *
 * @param {object} response - k6 Response object
 * @param {number} expectedStatus - Expected HTTP status code
 * @param {string} context - Test context description
 * @returns {boolean} Whether all checks passed
 */
export function validateResponse(response, expectedStatus = 200, context = 'request') {
  return check(response, {
    [`${context}: status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${context}: response time < 1000ms`]: (r) => r.timings.duration < 1000,
    [`${context}: response body exists`]: (r) => r.body && r.body.length > 0,
  });
}

/**
 * Validates JSON response structure.
 *
 * @param {object} response - k6 Response object
 * @param {string[]} requiredFields - Required fields in response
 * @param {string} context - Test context description
 * @returns {boolean} Whether all checks passed
 */
export function validateJsonResponse(response, requiredFields = [], context = 'json') {
  let json;
  try {
    json = response.json();
  } catch (e) {
    return check(null, {
      [`${context}: valid JSON`]: () => false,
    });
  }

  const checks = {
    [`${context}: valid JSON`]: () => json !== null,
  };

  for (const field of requiredFields) {
    checks[`${context}: has ${field}`] = () => json[field] !== undefined;
  }

  return check(json, checks);
}

/**
 * Random selection from array.
 *
 * @param {Array} array - Array to select from
 * @returns {*} Random element
 */
export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generates a random integer in range.
 *
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Sleeps for a random duration within range.
 *
 * @param {number} minMs - Minimum milliseconds
 * @param {number} maxMs - Maximum milliseconds
 */
export function randomSleep(minMs, maxMs) {
  const duration = randomInt(minMs, maxMs) / 1000;
  // eslint-disable-next-line no-undef
  sleep(duration);
}

/**
 * Generates search query parameters.
 *
 * @param {string} term - Search term
 * @param {object} options - Additional options
 * @returns {object} Query parameters
 */
export function generateSearchQuery(term, options = {}) {
  return {
    q: term,
    limit: options.limit || 20,
    offset: options.offset || 0,
    sort: options.sort || 'relevance',
    ...options,
  };
}

/**
 * Generates faceted search query.
 *
 * @param {string} term - Search term
 * @param {object} facets - Facet filters
 * @returns {object} Faceted query parameters
 */
export function generateFacetedQuery(term, facets = {}) {
  return {
    q: term,
    limit: 20,
    facets: {
      subjectArea: facets.subjectArea || [],
      year: facets.year || [],
      author: facets.author || [],
    },
    includeFacetCounts: true,
  };
}

/**
 * Tracks cache hit/miss metrics.
 *
 * @param {object} response - k6 Response object
 * @param {boolean} isCacheHit - Whether response was from cache
 */
export function trackCacheMetrics(response, isCacheHit) {
  customMetrics.cacheHitRate.add(isCacheHit ? 1 : 0);

  if (isCacheHit) {
    customMetrics.cacheHitDuration.add(response.timings.duration);
  } else {
    customMetrics.cacheMissDuration.add(response.timings.duration);
  }
}

/**
 * Formats bytes to human-readable string.
 *
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Creates a batch of operations for pipeline testing.
 *
 * @param {number} count - Number of operations
 * @param {string} type - Operation type ('view' or 'download')
 * @param {string[]} uris - Available URIs
 * @param {string[]} dids - Available DIDs
 * @returns {object[]} Batch operations array
 */
export function createBatchOperations(count, type, uris, dids) {
  const operations = [];
  for (let i = 0; i < count; i++) {
    operations.push({
      type,
      uri: randomChoice(uris),
      viewerDid: randomChoice(dids),
    });
  }
  return operations;
}
