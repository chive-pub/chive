/**
 * Schema compatibility service for tracking and reporting schema evolution.
 *
 * @remarks
 * This service detects legacy formats in ATProto records and generates migration
 * hints. It follows ATProto principles:
 *
 * - Accept both old and new formats (forward compatibility)
 * - Never break existing clients (additive hints only)
 * - Provide clear migration paths for record updates
 *
 * @example
 * ```typescript
 * import { SchemaCompatibilityService } from '@/services/schema/schema-compatibility.js';
 *
 * const service = new SchemaCompatibilityService();
 *
 * // Detect abstract format
 * const detection = service.detectAbstractFormat(record.abstract);
 * if (!detection.isCurrent) {
 *   console.log('Legacy abstract format detected:', detection.format);
 * }
 *
 * // Detect title format
 * const titleDetection = service.detectTitleFormat(record.title, record.titleRich);
 * if (!titleDetection.isCurrent) {
 *   console.log('Title could benefit from rich formatting:', titleDetection.format);
 * }
 *
 * // Get full compatibility info for API response
 * const info = service.analyzeEprintRecord(record);
 * if (info.migrationAvailable) {
 *   console.log('Migration hints:', info.migrationHints);
 * }
 * ```
 *
 * @packageDocumentation
 * @public
 */

import {
  type ApiSchemaHints,
  CURRENT_EPRINT_SCHEMA_VERSION,
  type DeprecatedFieldInfo,
  type DetectedSchemaFormat,
  type FieldFormatDetection,
  type SchemaCompatibilityInfo,
  type SchemaDetectionResult,
  type SchemaMigrationHint,
  type SchemaVersion,
  SCHEMA_MIGRATION_DOCS_BASE_URL,
  formatSchemaVersion,
} from '../../types/schema-compatibility.js';

// =============================================================================
// FORMAT TYPES
// =============================================================================

/**
 * Possible abstract formats in eprint records.
 *
 * @public
 */
export type AbstractFormat = 'string' | 'rich-text-array' | 'empty' | 'invalid';

/**
 * Possible title formats in eprint records.
 *
 * @remarks
 * - `plain`: Plain string title with no special formatting needed
 * - `plain-needs-rich`: Plain string title that contains special characters (LaTeX, etc.)
 *   and would benefit from `titleRich` array
 * - `with-rich`: Title has accompanying `titleRich` array for formatted display
 * - `empty`: Title is missing (invalid record)
 *
 * @public
 */
export type TitleFormat = 'plain' | 'plain-needs-rich' | 'with-rich' | 'empty';

/**
 * Possible review body formats.
 *
 * @public
 */
export type ReviewBodyFormat = 'string' | 'rich-text-array' | 'empty' | 'invalid';

/**
 * Regular expression patterns for detecting special formatting in titles.
 *
 * @internal
 */
const LATEX_INLINE_PATTERN = /\$[^$]+\$/;
const LATEX_DISPLAY_PATTERN = /\$\$[^$]+\$\$/;
const LATEX_COMMAND_PATTERN = /\\[a-zA-Z]+(\{[^}]*\}|\[[^\]]*\])*/;
const SUBSCRIPT_PATTERN = /_\{[^}]+\}|_[a-zA-Z0-9]/;
const SUPERSCRIPT_PATTERN = /\^\{[^}]+\}|\^[a-zA-Z0-9]/;

// =============================================================================
// SCHEMA COMPATIBILITY SERVICE
// =============================================================================

/**
 * Service for detecting and reporting schema compatibility issues.
 *
 * @remarks
 * This service is stateless and can be used as a singleton. It provides methods
 * for detecting legacy formats and generating migration hints that can be included
 * in API responses.
 *
 * @public
 */
export class SchemaCompatibilityService {
  /**
   * Current schema version this service targets.
   */
  readonly currentVersion: SchemaVersion = CURRENT_EPRINT_SCHEMA_VERSION;

  /**
   * Detects the format of an abstract field.
   *
   * @param abstract - Abstract value from a PDS record (string or RichTextItem[])
   * @returns Format detection result
   *
   * @remarks
   * Supports two formats:
   * - Legacy: plain string (schema < 0.1.0)
   * - Current: array of RichTextItem (schema >= 0.1.0)
   *
   * @example
   * ```typescript
   * // Legacy format
   * const legacyResult = service.detectAbstractFormat('Plain text abstract');
   * // { field: 'abstract', format: 'string', isCurrent: false }
   *
   * // Current format
   * const currentResult = service.detectAbstractFormat([
   *   { type: 'text', content: 'Rich text abstract' }
   * ]);
   * // { field: 'abstract', format: 'rich-text-array', isCurrent: true }
   * ```
   *
   * @public
   */
  detectAbstractFormat(abstract: unknown): FieldFormatDetection {
    const field = 'abstract';

    // Empty or missing
    if (abstract === undefined || abstract === null) {
      return {
        field,
        format: 'empty',
        isCurrent: true, // Empty is valid in both schemas
        metadata: { reason: 'missing-or-null' },
      };
    }

    // Legacy string format
    if (typeof abstract === 'string') {
      return {
        field,
        format: 'string',
        isCurrent: false,
        metadata: {
          length: abstract.length,
          detectedVersion: '0.0.0',
        },
      };
    }

    // Current array format
    if (Array.isArray(abstract)) {
      const isValidRichTextArray = this.isValidRichTextArray(abstract);
      return {
        field,
        format: 'rich-text-array',
        isCurrent: isValidRichTextArray,
        metadata: {
          itemCount: abstract.length,
          isValid: isValidRichTextArray,
          detectedVersion: formatSchemaVersion(this.currentVersion),
        },
      };
    }

    // Invalid format
    return {
      field,
      format: 'invalid',
      isCurrent: false,
      metadata: {
        actualType: typeof abstract,
        reason: 'unexpected-type',
      },
    };
  }

  /**
   * Detects the format of title fields.
   *
   * @param title - Plain text title string
   * @param titleRich - Optional rich text array for formatted title
   * @returns Format detection result
   *
   * @remarks
   * The lexicon has two title fields:
   * - `title`: Required plain string (always present)
   * - `titleRich`: Optional array of RichTextItem for formatted display
   *
   * Titles containing special characters (LaTeX, subscripts, superscripts) should
   * have a `titleRich` array. This method detects when a title could benefit from
   * rich formatting but does not have it.
   *
   * @example
   * ```typescript
   * // Plain title (no special formatting needed)
   * service.detectTitleFormat('Simple Title', undefined);
   * // { field: 'title', format: 'plain', isCurrent: true }
   *
   * // Title with LaTeX but no titleRich (needs migration)
   * service.detectTitleFormat('Study of $\\alpha$-decay', undefined);
   * // { field: 'title', format: 'plain-needs-rich', isCurrent: false }
   *
   * // Title with rich formatting (current format)
   * service.detectTitleFormat('Study of alpha-decay', [{type: 'text', content: '...'}]);
   * // { field: 'title', format: 'with-rich', isCurrent: true }
   * ```
   *
   * @public
   */
  detectTitleFormat(title: unknown, titleRich: unknown): FieldFormatDetection {
    const field = 'title';

    // Missing title
    if (title === undefined || title === null || title === '') {
      return {
        field,
        format: 'empty',
        isCurrent: false,
        metadata: { reason: 'missing-or-empty' },
      };
    }

    // Title must be a string
    if (typeof title !== 'string') {
      return {
        field,
        format: 'invalid',
        isCurrent: false,
        metadata: {
          actualType: typeof title,
          reason: 'unexpected-type',
        },
      };
    }

    // Check if titleRich is present and valid
    if (titleRich !== undefined && titleRich !== null) {
      if (Array.isArray(titleRich)) {
        const isValidRichTextArray = this.isValidRichTextArray(titleRich);
        return {
          field,
          format: 'with-rich',
          isCurrent: isValidRichTextArray,
          metadata: {
            titleLength: title.length,
            richItemCount: titleRich.length,
            isValid: isValidRichTextArray,
          },
        };
      }
      // titleRich is present but not an array (invalid)
      return {
        field,
        format: 'invalid',
        isCurrent: false,
        metadata: {
          actualType: typeof titleRich,
          reason: 'titleRich-not-array',
        },
      };
    }

    // No titleRich, check if title contains special formatting
    const hasSpecialFormatting = this.titleContainsSpecialFormatting(title);

    if (hasSpecialFormatting) {
      return {
        field,
        format: 'plain-needs-rich',
        isCurrent: false,
        metadata: {
          titleLength: title.length,
          hasLatex: LATEX_INLINE_PATTERN.test(title) || LATEX_DISPLAY_PATTERN.test(title),
          hasLatexCommand: LATEX_COMMAND_PATTERN.test(title),
          hasSubscript: SUBSCRIPT_PATTERN.test(title),
          hasSuperscript: SUPERSCRIPT_PATTERN.test(title),
        },
      };
    }

    // Plain title with no special formatting needed
    return {
      field,
      format: 'plain',
      isCurrent: true,
      metadata: {
        titleLength: title.length,
      },
    };
  }

  /**
   * Checks if a title string contains special formatting that would benefit from
   * a rich text representation.
   *
   * @param title - Plain text title
   * @returns True if title contains LaTeX, subscripts, superscripts, etc.
   *
   * @internal
   */
  private titleContainsSpecialFormatting(title: string): boolean {
    return (
      LATEX_INLINE_PATTERN.test(title) ||
      LATEX_DISPLAY_PATTERN.test(title) ||
      LATEX_COMMAND_PATTERN.test(title) ||
      SUBSCRIPT_PATTERN.test(title) ||
      SUPERSCRIPT_PATTERN.test(title)
    );
  }

  /**
   * Detects the format of a review body field.
   *
   * @param body - Body value from a review record (string or RichTextItem[])
   * @returns Format detection result
   *
   * @remarks
   * The current lexicon requires `body` to be an array of RichTextItems.
   * Old records may have `body` as a plain string.
   *
   * @example
   * ```typescript
   * // Legacy format
   * service.detectReviewBodyFormat('Plain text review');
   * // { field: 'body', format: 'string', isCurrent: false }
   *
   * // Current format
   * service.detectReviewBodyFormat([{type: 'text', content: 'Rich review'}]);
   * // { field: 'body', format: 'rich-text-array', isCurrent: true }
   * ```
   *
   * @public
   */
  detectReviewBodyFormat(body: unknown): FieldFormatDetection {
    const field = 'body';

    // Empty or missing
    if (body === undefined || body === null) {
      return {
        field,
        format: 'empty',
        isCurrent: false, // body is required for reviews
        metadata: { reason: 'missing-or-null' },
      };
    }

    // Legacy string format
    if (typeof body === 'string') {
      return {
        field,
        format: 'string',
        isCurrent: false,
        metadata: {
          length: body.length,
          detectedVersion: '0.0.0',
        },
      };
    }

    // Current array format
    if (Array.isArray(body)) {
      const isValidRichTextArray = this.isValidRichTextArray(body);
      return {
        field,
        format: 'rich-text-array',
        isCurrent: isValidRichTextArray,
        metadata: {
          itemCount: body.length,
          isValid: isValidRichTextArray,
          detectedVersion: formatSchemaVersion(this.currentVersion),
        },
      };
    }

    // Invalid format
    return {
      field,
      format: 'invalid',
      isCurrent: false,
      metadata: {
        actualType: typeof body,
        reason: 'unexpected-type',
      },
    };
  }

  /**
   * Validates that an array contains valid RichTextItem structures.
   *
   * @param items - Array to validate
   * @returns True if all items are valid RichTextItems
   *
   * @internal
   */
  private isValidRichTextArray(items: unknown[]): boolean {
    if (items.length === 0) {
      return true; // Empty array is valid
    }

    return items.every((item) => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }

      const typed = item as { type?: unknown; content?: unknown; uri?: unknown };

      // Must have a type field
      if (typeof typed.type !== 'string') {
        return false;
      }

      // Check known types
      const itemType = typed.type;
      if (itemType === 'text') {
        // Text items should have content
        return typeof typed.content === 'string' || typed.content === undefined;
      }

      if (itemType === 'nodeRef') {
        // Node refs should have uri
        return typeof typed.uri === 'string';
      }

      // Unknown type, but still potentially valid (open union)
      return true;
    });
  }

  /**
   * Gets deprecation info for the abstract field if using legacy format.
   *
   * @param detection - Field format detection result
   * @returns Deprecation info or null if using current format
   *
   * @internal
   */
  private getAbstractDeprecationInfo(detection: FieldFormatDetection): DeprecatedFieldInfo | null {
    if (detection.isCurrent || detection.format === 'empty') {
      return null;
    }

    if (detection.format === 'string') {
      return {
        field: 'abstract',
        detectedFormat: 'string',
        currentFormat: 'RichTextItem[]',
        deprecatedSince: '0.1.0',
        description:
          'Plain text abstracts should be converted to rich text arrays with text items. ' +
          'This enables entity linking and structured formatting.',
      };
    }

    if (detection.format === 'invalid') {
      const actualType =
        detection.metadata && 'actualType' in detection.metadata
          ? String(detection.metadata.actualType)
          : 'unknown';
      return {
        field: 'abstract',
        detectedFormat: actualType,
        currentFormat: 'RichTextItem[]',
        deprecatedSince: '0.0.0',
        description: 'Abstract field has an invalid format and should be corrected.',
      };
    }

    return null;
  }

  /**
   * Gets migration hints for the abstract field.
   *
   * @param detection - Field format detection result
   * @returns Migration hints or null if no migration needed
   *
   * @internal
   */
  private getAbstractMigrationHints(detection: FieldFormatDetection): SchemaMigrationHint | null {
    if (detection.isCurrent || detection.format === 'empty') {
      return null;
    }

    if (detection.format === 'string') {
      return {
        field: 'abstract',
        action: 'convert',
        instructions:
          'Convert the string abstract to an array with a single text item: ' +
          '[{ type: "text", content: "your abstract text" }]',
        documentationUrl: `${SCHEMA_MIGRATION_DOCS_BASE_URL}/abstract-richtext`,
        example: [{ type: 'text', content: 'Example abstract text with rich formatting support.' }],
      };
    }

    if (detection.format === 'invalid') {
      return {
        field: 'abstract',
        action: 'restructure',
        instructions:
          'The abstract field has an invalid format. ' +
          'Please provide either a string or an array of RichTextItem objects.',
        documentationUrl: `${SCHEMA_MIGRATION_DOCS_BASE_URL}/abstract-richtext`,
      };
    }

    return null;
  }

  /**
   * Gets deprecation info for the title field if it could benefit from rich formatting.
   *
   * @param detection - Field format detection result
   * @returns Deprecation info or null if using current format
   *
   * @internal
   */
  private getTitleDeprecationInfo(detection: FieldFormatDetection): DeprecatedFieldInfo | null {
    if (detection.isCurrent) {
      return null;
    }

    if (detection.format === 'plain-needs-rich') {
      return {
        field: 'title',
        detectedFormat: 'plain-string-with-special-chars',
        currentFormat: 'title + titleRich[]',
        deprecatedSince: '0.1.0',
        description:
          'Titles containing LaTeX, subscripts, or superscripts should include a titleRich array ' +
          'for proper rendering. The plain title field is kept for search and fallback display.',
      };
    }

    if (detection.format === 'empty') {
      return {
        field: 'title',
        detectedFormat: 'empty',
        currentFormat: 'string',
        deprecatedSince: '0.0.0',
        description: 'Title field is required and cannot be empty.',
      };
    }

    if (detection.format === 'invalid') {
      const actualType =
        detection.metadata && 'actualType' in detection.metadata
          ? String(detection.metadata.actualType)
          : 'unknown';
      return {
        field: 'title',
        detectedFormat: actualType,
        currentFormat: 'string',
        deprecatedSince: '0.0.0',
        description: 'Title field must be a string.',
      };
    }

    return null;
  }

  /**
   * Gets migration hints for the title field.
   *
   * @param detection - Field format detection result
   * @returns Migration hints or null if no migration needed
   *
   * @internal
   */
  private getTitleMigrationHints(detection: FieldFormatDetection): SchemaMigrationHint | null {
    if (detection.isCurrent) {
      return null;
    }

    if (detection.format === 'plain-needs-rich') {
      return {
        field: 'titleRich',
        action: 'add',
        instructions:
          'Add a titleRich array to properly render special formatting in the title. ' +
          'The array should contain text items and latex items for mathematical expressions. ' +
          'Keep the plain title field for search indexing and fallback display.',
        documentationUrl: `${SCHEMA_MIGRATION_DOCS_BASE_URL}/title-richtext`,
        example: [
          { type: 'text', content: 'Study of ' },
          { type: 'latex', content: '\\alpha', displayMode: false },
          { type: 'text', content: '-decay in heavy nuclei' },
        ],
      };
    }

    if (detection.format === 'empty') {
      return {
        field: 'title',
        action: 'add',
        instructions: 'The title field is required. Please provide a title for the eprint.',
        documentationUrl: `${SCHEMA_MIGRATION_DOCS_BASE_URL}/eprint-fields`,
      };
    }

    if (detection.format === 'invalid') {
      return {
        field: 'title',
        action: 'restructure',
        instructions: 'The title field must be a string.',
        documentationUrl: `${SCHEMA_MIGRATION_DOCS_BASE_URL}/eprint-fields`,
      };
    }

    return null;
  }

  /**
   * Gets deprecation info for the review body field if using legacy format.
   *
   * @param detection - Field format detection result
   * @returns Deprecation info or null if using current format
   *
   * @internal
   */
  private getReviewBodyDeprecationInfo(
    detection: FieldFormatDetection
  ): DeprecatedFieldInfo | null {
    if (detection.isCurrent) {
      return null;
    }

    if (detection.format === 'string') {
      return {
        field: 'body',
        detectedFormat: 'string',
        currentFormat: 'RichTextItem[]',
        deprecatedSince: '0.1.0',
        description:
          'Plain text review bodies should be converted to rich text arrays with text items. ' +
          'This enables entity linking, formatting, and structured references.',
      };
    }

    if (detection.format === 'empty') {
      return {
        field: 'body',
        detectedFormat: 'empty',
        currentFormat: 'RichTextItem[]',
        deprecatedSince: '0.0.0',
        description: 'Review body field is required and cannot be empty.',
      };
    }

    if (detection.format === 'invalid') {
      const actualType =
        detection.metadata && 'actualType' in detection.metadata
          ? String(detection.metadata.actualType)
          : 'unknown';
      return {
        field: 'body',
        detectedFormat: actualType,
        currentFormat: 'RichTextItem[]',
        deprecatedSince: '0.0.0',
        description: 'Review body field has an invalid format and should be corrected.',
      };
    }

    return null;
  }

  /**
   * Gets migration hints for the review body field.
   *
   * @param detection - Field format detection result
   * @returns Migration hints or null if no migration needed
   *
   * @internal
   */
  private getReviewBodyMigrationHints(detection: FieldFormatDetection): SchemaMigrationHint | null {
    if (detection.isCurrent) {
      return null;
    }

    if (detection.format === 'string') {
      return {
        field: 'body',
        action: 'convert',
        instructions:
          'Convert the string body to an array with a single text item: ' +
          '[{ type: "text", content: "your review text" }]',
        documentationUrl: `${SCHEMA_MIGRATION_DOCS_BASE_URL}/review-body-richtext`,
        example: [{ type: 'text', content: 'Example review text with rich formatting support.' }],
      };
    }

    if (detection.format === 'empty') {
      return {
        field: 'body',
        action: 'add',
        instructions: 'The body field is required. Please provide content for the review.',
        documentationUrl: `${SCHEMA_MIGRATION_DOCS_BASE_URL}/review-fields`,
      };
    }

    if (detection.format === 'invalid') {
      return {
        field: 'body',
        action: 'restructure',
        instructions:
          'The body field has an invalid format. ' +
          'Please provide an array of RichTextItem objects.',
        documentationUrl: `${SCHEMA_MIGRATION_DOCS_BASE_URL}/review-body-richtext`,
      };
    }

    return null;
  }

  /**
   * Analyzes an eprint record for schema compatibility.
   *
   * @param record - Raw eprint record from PDS
   * @returns Full schema detection result
   *
   * @remarks
   * Analyzes all fields that may have evolved between schema versions.
   * Currently checks:
   * - abstract: string vs RichTextItem[]
   * - title: plain string vs title + titleRich[] for special formatting
   *
   * @example
   * ```typescript
   * const record = await fetchRecordFromPds(uri);
   * const result = service.analyzeEprintRecord(record);
   *
   * if (!result.isCurrentSchema) {
   *   logger.info('Legacy record detected', {
   *     deprecatedFields: result.compatibility.deprecatedFields,
   *   });
   * }
   * ```
   *
   * @public
   */
  analyzeEprintRecord(record: unknown): SchemaDetectionResult {
    const fieldDetections: FieldFormatDetection[] = [];
    const deprecatedFields: DeprecatedFieldInfo[] = [];
    const migrationHints: SchemaMigrationHint[] = [];

    // Type guard for record
    if (typeof record !== 'object' || record === null) {
      return {
        compatibility: {
          schemaVersion: { major: 0, minor: 0, patch: 0 },
          detectedFormat: 'unknown',
          deprecatedFields: [],
          migrationAvailable: false,
        },
        fieldDetections: [],
        isCurrentSchema: false,
      };
    }

    const typedRecord = record as { abstract?: unknown; title?: unknown; titleRich?: unknown };

    // Analyze abstract format
    const abstractDetection = this.detectAbstractFormat(typedRecord.abstract);
    fieldDetections.push(abstractDetection);

    const abstractDeprecation = this.getAbstractDeprecationInfo(abstractDetection);
    if (abstractDeprecation) {
      deprecatedFields.push(abstractDeprecation);
    }

    const abstractMigration = this.getAbstractMigrationHints(abstractDetection);
    if (abstractMigration) {
      migrationHints.push(abstractMigration);
    }

    // Analyze title format
    const titleDetection = this.detectTitleFormat(typedRecord.title, typedRecord.titleRich);
    fieldDetections.push(titleDetection);

    const titleDeprecation = this.getTitleDeprecationInfo(titleDetection);
    if (titleDeprecation) {
      deprecatedFields.push(titleDeprecation);
    }

    const titleMigration = this.getTitleMigrationHints(titleDetection);
    if (titleMigration) {
      migrationHints.push(titleMigration);
    }

    // Determine overall detected format
    const detectedFormat: DetectedSchemaFormat = deprecatedFields.length > 0 ? 'legacy' : 'current';

    // Infer schema version from field formats
    const inferredVersion = this.inferSchemaVersion(fieldDetections);

    const compatibility: SchemaCompatibilityInfo = {
      schemaVersion: inferredVersion,
      detectedFormat,
      deprecatedFields,
      migrationAvailable: migrationHints.length > 0,
      migrationHints: migrationHints.length > 0 ? migrationHints : undefined,
    };

    return {
      compatibility,
      fieldDetections,
      isCurrentSchema: deprecatedFields.length === 0,
    };
  }

  /**
   * Analyzes a review record for schema compatibility.
   *
   * @param record - Raw review record from PDS
   * @returns Full schema detection result
   *
   * @remarks
   * Analyzes all fields that may have evolved between schema versions.
   * Currently checks:
   * - body: string vs RichTextItem[]
   *
   * @example
   * ```typescript
   * const record = await fetchRecordFromPds(reviewUri);
   * const result = service.analyzeReviewRecord(record);
   *
   * if (!result.isCurrentSchema) {
   *   logger.info('Legacy review detected', {
   *     deprecatedFields: result.compatibility.deprecatedFields,
   *   });
   * }
   * ```
   *
   * @public
   */
  analyzeReviewRecord(record: unknown): SchemaDetectionResult {
    const fieldDetections: FieldFormatDetection[] = [];
    const deprecatedFields: DeprecatedFieldInfo[] = [];
    const migrationHints: SchemaMigrationHint[] = [];

    // Type guard for record
    if (typeof record !== 'object' || record === null) {
      return {
        compatibility: {
          schemaVersion: { major: 0, minor: 0, patch: 0 },
          detectedFormat: 'unknown',
          deprecatedFields: [],
          migrationAvailable: false,
        },
        fieldDetections: [],
        isCurrentSchema: false,
      };
    }

    const typedRecord = record as { body?: unknown };

    // Analyze body format
    const bodyDetection = this.detectReviewBodyFormat(typedRecord.body);
    fieldDetections.push(bodyDetection);

    const bodyDeprecation = this.getReviewBodyDeprecationInfo(bodyDetection);
    if (bodyDeprecation) {
      deprecatedFields.push(bodyDeprecation);
    }

    const bodyMigration = this.getReviewBodyMigrationHints(bodyDetection);
    if (bodyMigration) {
      migrationHints.push(bodyMigration);
    }

    // Determine overall detected format
    const detectedFormat: DetectedSchemaFormat = deprecatedFields.length > 0 ? 'legacy' : 'current';

    // Infer schema version from field formats
    const inferredVersion = this.inferSchemaVersion(fieldDetections);

    const compatibility: SchemaCompatibilityInfo = {
      schemaVersion: inferredVersion,
      detectedFormat,
      deprecatedFields,
      migrationAvailable: migrationHints.length > 0,
      migrationHints: migrationHints.length > 0 ? migrationHints : undefined,
    };

    return {
      compatibility,
      fieldDetections,
      isCurrentSchema: deprecatedFields.length === 0,
    };
  }

  /**
   * Infers schema version from field format detections.
   *
   * @param detections - Field format detections
   * @returns Inferred schema version
   *
   * @remarks
   * Checks for legacy formats across all detected fields. If any field uses
   * a pre-0.1.0 format, returns version 0.0.0.
   *
   * @internal
   */
  private inferSchemaVersion(detections: FieldFormatDetection[]): SchemaVersion {
    // Check for legacy abstract format
    const abstractDetection = detections.find((d) => d.field === 'abstract');
    if (abstractDetection?.format === 'string') {
      return { major: 0, minor: 0, patch: 0 };
    }

    // Check for legacy body format (reviews)
    const bodyDetection = detections.find((d) => d.field === 'body');
    if (bodyDetection?.format === 'string') {
      return { major: 0, minor: 0, patch: 0 };
    }

    // Check for title needing rich formatting (considered a minor issue, not pre-0.1.0)
    // Title format detection does not affect version inference since plain titles
    // without special formatting are still valid in the current schema

    // Default to current version
    return this.currentVersion;
  }

  /**
   * Generates API schema hints for response inclusion.
   *
   * @param result - Schema detection result
   * @returns API hints object (can be spread into response)
   *
   * @remarks
   * Returns undefined if no hints are needed (record uses current schema).
   * This keeps API responses clean for up-to-date records.
   *
   * @example
   * ```typescript
   * const result = service.analyzeEprintRecord(record);
   * const hints = service.generateApiHints(result);
   *
   * const response = {
   *   uri: record.uri,
   *   value: record,
   *   ...(hints && { _schemaHints: hints }),
   * };
   * ```
   *
   * @public
   */
  generateApiHints(result: SchemaDetectionResult): ApiSchemaHints | undefined {
    // No hints needed for current schema
    if (result.isCurrentSchema) {
      return undefined;
    }

    // Determine migration URL if available
    let migrationUrl: string | undefined;
    if (result.compatibility.migrationHints && result.compatibility.migrationHints.length > 0) {
      const firstHint = result.compatibility.migrationHints[0];
      if (firstHint) {
        migrationUrl = firstHint.documentationUrl ?? `${SCHEMA_MIGRATION_DOCS_BASE_URL}/overview`;
      }
    }

    const hints: ApiSchemaHints = {
      schemaVersion: formatSchemaVersion(result.compatibility.schemaVersion),
      deprecatedFields: result.compatibility.deprecatedFields.map((d) => d.field),
      migrationAvailable: result.compatibility.migrationAvailable,
      migrationUrl,
    };

    return hints;
  }

  /**
   * Checks if a record needs migration.
   *
   * @param record - Raw eprint record from PDS
   * @returns True if the record uses any deprecated formats
   *
   * @public
   */
  needsMigration(record: unknown): boolean {
    const result = this.analyzeEprintRecord(record);
    return !result.isCurrentSchema;
  }

  /**
   * Gets the current schema version string.
   *
   * @returns Current schema version as a string (e.g., "1.1.0")
   *
   * @public
   */
  getCurrentVersionString(): string {
    return formatSchemaVersion(this.currentVersion);
  }
}

/**
 * Default schema compatibility service instance.
 *
 * @remarks
 * The service is stateless, so a single instance can be shared across the application.
 *
 * @public
 */
export const schemaCompatibilityService = new SchemaCompatibilityService();
