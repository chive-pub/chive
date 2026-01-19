# Test Setup

Global test configuration and setup.

## Overview

This directory contains global setup files that run before test suites. It configures the test environment, mocks global APIs, and sets up test databases.

## Files

| File              | Description              |
| ----------------- | ------------------------ |
| `global-setup.ts` | Vitest global setup hook |

## Global Setup

The `global-setup.ts` file runs once before all tests:

- Loads environment variables from `.env.test`
- Initializes test database connections
- Seeds required test data
- Sets up global mocks

## Configuration

The setup is referenced in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globalSetup: './tests/setup/global-setup.ts',
    setupFiles: ['./tests/setup/setup.ts'],
  },
});
```

## Environment Variables

Test-specific environment variables (`.env.test`):

```bash
DATABASE_URL=postgresql://test@localhost:5432/chive_test
REDIS_URL=redis://localhost:6379/1
ELASTICSEARCH_URL=http://localhost:9200
```

## Related Documentation

- [Testing overview](../README.md)
- [Unit tests](../unit/README.md)
- [Integration tests](../integration/README.md)
