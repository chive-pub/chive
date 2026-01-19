# Test Fixtures

Shared test data factories and mock data generators used across unit and integration tests.

## Overview

This directory contains reusable test data generation utilities that provide consistent mock objects for testing. These fixtures follow the new author model with unified authors array, submittedBy, and paperDid fields.

## Files

| File              | Description                                    |
| ----------------- | ---------------------------------------------- |
| `mock-authors.ts` | Factory functions for author-related test data |

## Mock Author Utilities

### Available Functions

```typescript
import {
  createMockAbstract,
  createMockAffiliation,
  createMockContribution,
  createMockAuthor,
  createMockExternalAuthor,
  createMockAuthors,
  createMockEprintData,
} from '@tests/fixtures/mock-authors';
```

### Function Reference

| Function                               | Description                               |
| -------------------------------------- | ----------------------------------------- |
| `createMockAbstract(text)`             | Creates a RichText body from plain text   |
| `createMockAffiliation(overrides?)`    | Creates an author affiliation with ROR ID |
| `createMockContribution(overrides?)`   | Creates a CRediT-style contribution role  |
| `createMockAuthor(overrides?)`         | Creates a full author with DID            |
| `createMockExternalAuthor(overrides?)` | Creates an external author (no DID)       |
| `createMockAuthors(count?)`            | Creates array of mock authors             |
| `createMockEprintData(overrides?)`     | Creates complete eprint test data         |

## Usage Example

```typescript
import { createMockEprintData, createMockAuthor } from '@tests/fixtures/mock-authors';

describe('EprintService', () => {
  it('should index eprint with authors', async () => {
    const eprint = createMockEprintData({
      title: 'Test Paper',
      authors: [
        createMockAuthor({ name: 'Alice', order: 1 }),
        createMockAuthor({ name: 'Bob', order: 2 }),
      ],
    });

    await service.indexEprint(eprint);
  });
});
```

## Related

- `tests/helpers/` - Test helper utilities
- `tests/e2e/fixtures/` - E2E-specific fixtures and page objects
