# Test Mocks

Mock implementations for external API dependencies.

## Overview

This directory contains mock implementations of external APIs used in testing. Mocks provide deterministic responses without making actual network requests.

## Available Mocks

| Mock                 | File                      | Description                          |
| -------------------- | ------------------------- | ------------------------------------ |
| OpenAlex API         | `openalex-api.ts`         | Mock for OpenAlex scholarly data API |
| Semantic Scholar API | `semantic-scholar-api.ts` | Mock for Semantic Scholar API        |

## Usage

```typescript
import { mockOpenAlexApi, mockSemanticScholarApi } from '../mocks';

describe('EnrichmentService', () => {
  beforeEach(() => {
    mockOpenAlexApi.reset();
    mockSemanticScholarApi.reset();
  });

  it('enriches eprint with OpenAlex data', async () => {
    mockOpenAlexApi.addWork({
      id: 'W123',
      doi: '10.1234/example',
      concepts: [{ id: 'C123', display_name: 'Machine Learning' }],
    });

    const result = await enrichmentService.enrich(eprintUri);
    expect(result.concepts).toContain('Machine Learning');
  });
});
```

## Mock Features

- **Deterministic responses** - Same input always produces same output
- **Configurable delays** - Simulate network latency
- **Error simulation** - Test error handling paths
- **Request recording** - Verify API calls made

## Related Documentation

- [Unit tests](../unit/README.md)
- [Integration tests](../integration/README.md)
