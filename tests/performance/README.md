# Performance Tests

Load and performance benchmarks using k6.

## Overview

Performance tests measure system behavior under various load conditions including normal operations, stress scenarios, and spike testing. All tests use k6 for consistent, scriptable load generation.

## Directory Structure

```
performance/
└── k6/
    ├── config.js              # Centralized configuration
    ├── lib/
    │   └── helpers.js         # Shared helper functions
    └── scenarios/
        ├── blob-proxy-load.js     # Blob proxy caching performance
        ├── eprint-indexing.js     # Eprint indexing throughput
        ├── metrics-recording.js   # Metrics write performance
        └── search-query.js        # Search query latency
```

## Running Tests

```bash
# Run all performance tests
pnpm test:performance

# Run specific scenario
k6 run tests/performance/k6/scenarios/search-query.js

# Run with custom environment
K6_ENV=staging k6 run tests/performance/k6/scenarios/search-query.js

# Run with custom stage
k6 run --stage 1m:100,5m:100,1m:0 tests/performance/k6/scenarios/eprint-indexing.js
```

## Configuration

See `k6/config.js` for:

- Environment URLs (local, staging, production)
- Performance thresholds per scenario
- Standard stage definitions (smoke, load, stress, spike, soak)
- Test data samples

### Environments

| Environment | Base URL                  |
| ----------- | ------------------------- |
| local       | http://localhost:3000     |
| staging     | https://staging.chive.pub |
| production  | https://chive.pub         |

Set environment with `K6_ENV` variable.

### Standard Stages

| Stage          | Description                          |
| -------------- | ------------------------------------ |
| smoke          | Quick validation (30s ramp, 1m hold) |
| load           | Standard load test (50 VUs, 5m hold) |
| stress         | Increasing load to 200 VUs           |
| spike          | Sudden spike to 500 VUs              |
| soak           | Extended 4-hour test at 100 VUs      |
| highThroughput | Ramp to 1000 VUs                     |

## Performance Thresholds

### Eprint Indexing

- p95 < 200ms
- p99 < 500ms
- Error rate < 1%

### Blob Proxy (L1 Cache)

- p95 < 50ms
- p99 < 100ms
- Error rate < 1%

### Search Queries

- p95 < 300ms
- p99 < 1000ms
- Error rate < 1%

### Metrics Recording

- p95 < 10ms
- p99 < 50ms
- Error rate < 0.1%

## Writing New Scenarios

```javascript
import { config, thresholds, stages } from '../config.js';
import { randomItem } from '../lib/helpers.js';
import http from 'k6/http';

export const options = {
  stages: stages.load,
  thresholds: thresholds.searchQuery,
};

export default function () {
  const term = randomItem(config.testData.searchTerms);
  http.get(`${config.baseUrl}/xrpc/pub.chive.eprint.search?q=${term}`);
}
```

## Related

- `.claude/design/13-testing/` - Testing strategy
- `tests/integration/` - Integration tests
