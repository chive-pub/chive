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
// ABSTRACT FORMAT TYPES
// =============================================================================

/**
 * Possible abstract formats in eprint records.
 *
 * @public
 */
export type AbstractFormat = 'string' | 'rich-text-array' | 'empty' | 'invalid';

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
   * Analyzes an eprint record for schema compatibility.
   *
   * @param record - Raw eprint record from PDS
   * @returns Full schema detection result
   *
   * @remarks
   * Analyzes all fields that may have evolved between schema versions.
   * Currently checks:
   * - abstract: string vs RichTextItem[]
   *
   * Future fields may include version format, author structure, etc.
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

    const typedRecord = record as { abstract?: unknown };

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
   * @internal
   */
  private inferSchemaVersion(detections: FieldFormatDetection[]): SchemaVersion {
    // Check for legacy abstract format
    const abstractDetection = detections.find((d) => d.field === 'abstract');
    if (abstractDetection?.format === 'string') {
      return { major: 0, minor: 0, patch: 0 };
    }

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
