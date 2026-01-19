# Test Types

TypeScript type definitions for test utilities.

## Overview

This directory contains shared type definitions used across test suites for API responses, fixtures, and test utilities.

## Files

| File               | Description                               |
| ------------------ | ----------------------------------------- |
| `api-responses.ts` | Type definitions for mocked API responses |

## Usage

```typescript
import type { MockedApiResponse, TestEprint } from '../types/api-responses';

const mockResponse: MockedApiResponse<TestEprint> = {
  data: { uri: 'at://...', title: 'Test' },
  status: 200,
  headers: {},
};
```

## Related Documentation

- [Mocks](../mocks/README.md)
- [Unit tests](../unit/README.md)
