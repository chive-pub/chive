/**
 * k6 performance test configuration.
 *
 * @description
 * Centralized configuration for all k6 performance benchmarks.
 * Provides base URLs, thresholds, and common stage definitions.
 */

/**
 * Base configuration for test environments.
 */
export const environments = {
  local: {
    baseUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000',
  },
  staging: {
    baseUrl: 'https://staging.chive.pub',
    wsUrl: 'wss://staging.chive.pub',
  },
  production: {
    baseUrl: 'https://chive.pub',
    wsUrl: 'wss://chive.pub',
  },
};

/**
 * Default environment (override with K6_ENV).
 */
export const currentEnv = __ENV.K6_ENV || 'local';
export const config = environments[currentEnv];

/**
 * Standard threshold definitions.
 */
export const thresholds = {
  // Preprint indexing
  preprintIndexing: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },

  // Blob proxy (L1 cache)
  blobProxyL1: {
    http_req_duration: ['p(95)<50', 'p(99)<100'],
    http_req_failed: ['rate<0.01'],
  },

  // Blob proxy (L2/L3 fallback)
  blobProxyFallback: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.05'],
  },

  // Search queries
  searchQuery: {
    http_req_duration: ['p(95)<300', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },

  // Metrics recording
  metricsRecording: {
    http_req_duration: ['p(95)<10', 'p(99)<50'],
    http_req_failed: ['rate<0.001'],
  },
};

/**
 * Standard stage definitions for load testing.
 */
export const stages = {
  // Quick smoke test
  smoke: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 5 },
    { duration: '30s', target: 0 },
  ],

  // Standard load test
  load: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],

  // Stress test
  stress: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],

  // Spike test
  spike: [
    { duration: '1m', target: 10 },
    { duration: '30s', target: 500 },
    { duration: '1m', target: 500 },
    { duration: '30s', target: 10 },
    { duration: '1m', target: 0 },
  ],

  // Soak test (extended duration)
  soak: [
    { duration: '5m', target: 100 },
    { duration: '4h', target: 100 },
    { duration: '5m', target: 0 },
  ],

  // High throughput test
  highThroughput: [
    { duration: '1m', target: 100 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
};

/**
 * Test data generation bounds.
 */
export const testData = {
  // Sample DIDs for testing
  sampleDIDs: [
    'did:plc:perf1',
    'did:plc:perf2',
    'did:plc:perf3',
    'did:plc:perf4',
    'did:plc:perf5',
  ],

  // Sample CIDs for blob testing
  sampleCIDs: [
    'bafyreiblob001',
    'bafyreiblob002',
    'bafyreiblob003',
    'bafyreiblob004',
    'bafyreiblob005',
  ],

  // Sample search terms
  searchTerms: [
    'machine learning',
    'quantum computing',
    'climate change',
    'gene therapy',
    'neural networks',
    'protein folding',
    'renewable energy',
    'cryptography',
  ],

  // Subject areas for faceted search
  subjectAreas: [
    'computer-science',
    'physics',
    'biology',
    'chemistry',
    'mathematics',
    'medicine',
  ],
};
