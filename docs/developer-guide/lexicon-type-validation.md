# Lexicon type validation

This guide covers the pattern for using generated lexicon types with runtime validation in Chive services. This approach provides compile-time type safety while ensuring runtime correctness when processing records from the ATProto firehose.

## Overview

Chive generates TypeScript types from lexicon schemas using the ATProto lexicon code generator. These generated types include:

- **Interface definitions**: TypeScript interfaces matching the lexicon schema
- **Type guards**: `isRecord()` functions for runtime validation
- **Validation functions**: `validateRecord()` functions for detailed error reporting

Services accept `unknown` data from the firehose and use type guards to validate records before processing.

## Generated type structure

For each lexicon record, the generator produces a module with these exports:

```typescript
// From src/lexicons/generated/types/pub/chive/review/comment.ts

// The main record interface
export interface Main {
  $type: 'pub.chive.review.comment';
  eprintUri: string;
  body: (TextItem | NodeRefItem | /* ... */)[];
  parentComment?: string;
  createdAt: string;
  [k: string]: unknown;
}

// Type guard for runtime validation
export function isMain<V>(v: V): v is Main { /* ... */ }

// Detailed validation with error messages
export function validateMain<V>(v: V): ValidationResult<Main & V> { /* ... */ }

// Re-exports with standard names
export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
};
```

The `isRecord` type guard is the primary tool for runtime validation. It checks that the value has the correct `$type` discriminator and validates the structure against the lexicon schema.

## Pattern: Accept unknown, validate internally

Services accept `unknown` for record parameters and validate internally using type guards. This approach:

1. **Avoids unsafe type assertions** at API boundaries
2. **Centralizes validation logic** within the service
3. **Returns typed errors** when validation fails
4. **Narrows the type** to the validated interface after the guard passes

### Implementation example

The `ReviewService` demonstrates this pattern:

```typescript
import {
  isRecord as isCommentRecord,
  type Main as CommentRecord,
} from '../../lexicons/generated/types/pub/chive/review/comment.js';
import {
  isRecord as isEndorsementRecord,
  type Main as EndorsementRecord,
} from '../../lexicons/generated/types/pub/chive/review/endorsement.js';
import { ValidationError } from '../../types/errors.js';
import { Err, Ok, type Result } from '../../types/result.js';

export class ReviewService {
  /**
   * Indexes review comment from firehose.
   *
   * @param record - review comment record (unknown, validated internally)
   * @param metadata - record metadata
   * @returns result indicating success or failure
   */
  async indexReview(
    record: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    // validate record against lexicon schema
    if (!isCommentRecord(record)) {
      const validationError = new ValidationError(
        'Record does not match pub.chive.review.comment schema',
        'record',
        'schema'
      );
      this.logger.warn('Invalid review comment record', { uri: metadata.uri });
      return Err(validationError);
    }

    // type is narrowed to CommentRecord after the guard
    const comment = record;

    // access typed fields safely
    await this.pool.query(`INSERT INTO reviews_index (...) VALUES ($1, $2, $3, ...)`, [
      metadata.uri,
      metadata.cid,
      comment.eprintUri, // typed as string
      comment.body, // typed as rich text array
      comment.parentComment ?? null, // typed as string | undefined
      new Date(comment.createdAt),
    ]);

    return Ok(undefined);
  }
}
```

### Why this is better than type assertions

**Unsafe pattern (avoid):**

```typescript
// BAD: Assumes the record is valid without checking
async indexReview(record: CommentRecord, metadata: RecordMetadata) {
  // If record is malformed, this will throw at runtime
  // or silently produce incorrect data
  await this.store(record.eprintUri);
}

// BAD: Type assertion without validation
async indexReview(record: unknown, metadata: RecordMetadata) {
  const comment = record as CommentRecord; // No runtime check!
  await this.store(comment.eprintUri); // Might be undefined
}
```

**Safe pattern (use this):**

```typescript
// GOOD: Validate then use typed value
async indexReview(record: unknown, metadata: RecordMetadata) {
  if (!isCommentRecord(record)) {
    return Err(new ValidationError('Invalid record', 'record', 'schema'));
  }

  // TypeScript knows record is CommentRecord here
  await this.store(record.eprintUri); // Guaranteed to exist
}
```

## Type guard behavior

The `isRecord` type guards check:

1. **Type discriminator**: The `$type` field matches the expected lexicon ID
2. **Required fields**: All required fields are present with correct types
3. **Field types**: Optional fields, if present, have correct types
4. **Union types**: Union fields contain valid variants

Example from the generated comment type guard:

```typescript
export function isMain<V>(v: V): v is Main & V {
  return is$typed(v, 'pub.chive.review.comment', 'main');
}
```

The guard returns `true` only if the value fully matches the schema, narrowing the TypeScript type to the validated interface.

## Re-exporting types for external use

Services re-export generated types with domain-appropriate names for external consumers:

```typescript
// In review-service.ts
import { type Main as CommentRecord } from '../../lexicons/generated/types/pub/chive/review/comment.js';
import { type Main as EndorsementRecord } from '../../lexicons/generated/types/pub/chive/review/endorsement.js';

/**
 * Re-export generated lexicon types for external use.
 *
 * @public
 */
export type { CommentRecord as ReviewComment, EndorsementRecord as Endorsement };
```

External code imports from the service module rather than the generated types:

```typescript
// External usage
import type { ReviewComment, Endorsement } from '@/services/review/review-service.js';
```

This provides:

- **Stable API surface**: External code is insulated from generated type paths
- **Domain naming**: Types use names that match the service domain
- **Single source of truth**: The service controls which types are public

## Validation with detailed errors

For cases requiring detailed error messages, use `validateRecord()`:

```typescript
import {
  validateRecord as validateComment,
  type Main as CommentRecord,
} from '../../lexicons/generated/types/pub/chive/review/comment.js';

async indexReview(record: unknown, metadata: RecordMetadata) {
  const validation = validateComment(record);

  if (!validation.success) {
    // validation.error contains detailed field-level errors
    this.logger.warn('Invalid review comment', {
      uri: metadata.uri,
      errors: validation.error,
    });
    return Err(new ValidationError(
      `Invalid record: ${validation.error}`,
      'record',
      'schema'
    ));
  }

  // validation.value is the validated record
  const comment = validation.value;
  // ...
}
```

The `validateRecord()` function returns a `ValidationResult` with either:

- `{ success: true, value: T }` on success
- `{ success: false, error: string }` on failure with a description of what failed

## Import organization

Organize lexicon type imports with explicit renaming to avoid collisions:

```typescript
// Import type guards with prefixed names
import {
  isRecord as isCommentRecord,
  type Main as CommentRecord,
} from '../../lexicons/generated/types/pub/chive/review/comment.js';
import {
  isRecord as isEndorsementRecord,
  type Main as EndorsementRecord,
} from '../../lexicons/generated/types/pub/chive/review/endorsement.js';
import {
  isRecord as isSubmissionRecord,
  type Main as SubmissionRecord,
} from '../../lexicons/generated/types/pub/chive/eprint/submission.js';
```

This pattern:

- Uses descriptive names (`isCommentRecord` vs generic `isRecord`)
- Makes it clear which lexicon each guard validates
- Avoids import collisions when working with multiple lexicons

## Testing validated services

Test both valid and invalid record handling:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ReviewService } from './review-service.js';

describe('ReviewService', () => {
  describe('indexReview', () => {
    it('indexes valid comment record', async () => {
      const service = new ReviewService({ pool, logger });

      const record = {
        $type: 'pub.chive.review.comment',
        eprintUri: 'at://did:plc:abc/pub.chive.eprint.submission/xyz',
        body: [{ type: 'text', content: 'Great paper!' }],
        createdAt: '2024-01-15T12:00:00Z',
      };

      const result = await service.indexReview(record, metadata);

      expect(result.ok).toBe(true);
    });

    it('returns ValidationError for invalid record', async () => {
      const service = new ReviewService({ pool, logger });

      const invalidRecord = {
        $type: 'pub.chive.review.comment',
        // missing required eprintUri
        body: [],
        createdAt: '2024-01-15T12:00:00Z',
      };

      const result = await service.indexReview(invalidRecord, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns ValidationError for wrong record type', async () => {
      const service = new ReviewService({ pool, logger });

      const wrongTypeRecord = {
        $type: 'pub.chive.review.endorsement', // wrong type for indexReview
        eprintUri: 'at://did:plc:abc/pub.chive.eprint.submission/xyz',
        contributions: ['methodological'],
        createdAt: '2024-01-15T12:00:00Z',
      };

      const result = await service.indexReview(wrongTypeRecord, metadata);

      expect(result.ok).toBe(false);
    });
  });
});
```

## Summary

The lexicon type validation pattern provides:

| Aspect             | Approach                                         |
| ------------------ | ------------------------------------------------ |
| Parameter type     | Accept `unknown` from external callers           |
| Runtime validation | Use `isRecord()` type guards                     |
| Type narrowing     | TypeScript narrows type after guard passes       |
| Error handling     | Return `Result<T, ValidationError>` on failure   |
| External API       | Re-export types with domain names                |
| Detailed errors    | Use `validateRecord()` when error details needed |

This pattern ensures type safety at both compile time and runtime while providing clear error messages when records do not match their lexicon schemas.

## Related documentation

- [Core business services](./core-business-services.md): Service architecture overview
- [Indexing service](./services/indexing.md): Firehose consumption pipeline
- [Error handling](./services/README.md#error-handling-patterns): Result type patterns
