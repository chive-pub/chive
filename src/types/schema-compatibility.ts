/**
 * Schema compatibility types for ATProto lexicon evolution.
 *
 * @remarks
 * This module provides types for tracking schema versions, detecting legacy formats,
 * and generating migration hints. Chive follows ATProto principles for schema evolution:
 *
 * - Forward compatibility: Accept both old and new formats
 * - No breaking changes: Add fields, never remove or change existing ones
 * - Graceful degradation: Always normalize to current internal model
 * - User notification: Include hints in responses to encourage updates
 *
 * @example
 * ```typescript
 * import type {
 *   SchemaVersion,
 *   SchemaCompatibilityInfo,
 *   SchemaMigrationHint,
 * } from '@/types/schema-compatibility.js';
 *
 * const info: SchemaCompatibilityInfo = {
 *   schemaVersion: { major: 1, minor: 2, patch: 0 },
 *   detectedFormat: 'legacy',
 *   deprecatedFields: [
 *     {
 *       field: 'abstract',
 *       detectedFormat: 'string',
 *       currentFormat: 'RichTextBody[]',
 *       since: '0.1.0',
 *     },
 *   ],
 *   migrationAvailable: true,
 * };
 * ```
 *
 * @packageDocumentation
 * @public
 */

// =============================================================================
// SCHEMA VERSION TRACKING
// =============================================================================

/**
 * Semantic version for schema tracking.
 *
 * @remarks
 * Follows semver conventions:
 * - Major: Breaking changes (new required fields, removed fields)
 * - Minor: New optional fields, new enum values, format changes with backward compat
 * - Patch: Documentation changes, clarifications
 *
 * @public
 */
export interface SchemaVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/**
 * Formats a schema version as a string.
 *
 * @param version - Schema version object
 * @returns Version string (e.g., "1.2.0")
 *
 * @public
 */
export function formatSchemaVersion(version: SchemaVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Parses a version string into a SchemaVersion object.
 *
 * @param versionString - Version string (e.g., "1.2.0")
 * @returns Parsed schema version, or null if invalid
 *
 * @public
 */
export function parseSchemaVersion(versionString: string): SchemaVersion | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(versionString);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compares two schema versions.
 *
 * @param a - First version
 * @param b - Second version
 * @returns Negative if a < b, positive if a > b, zero if equal
 *
 * @public
 */
export function compareSchemaVersions(a: SchemaVersion, b: SchemaVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

// =============================================================================
// DEPRECATED FIELD TRACKING
// =============================================================================

/**
 * Information about a field using a deprecated format.
 *
 * @remarks
 * Tracks which fields in a record are using older formats that should be updated.
 * Used to inform clients about available migrations without breaking their code.
 *
 * @public
 */
export interface DeprecatedFieldInfo {
  /**
   * Field path (e.g., "abstract", "authors[0].contributions").
   */
  readonly field: string;

  /**
   * Format detected in the record (e.g., "string", "array").
   */
  readonly detectedFormat: string;

  /**
   * Current recommended format (e.g., "RichTextBody[]").
   */
  readonly currentFormat: string;

  /**
   * Schema version when this format was deprecated.
   */
  readonly deprecatedSince: string;

  /**
   * Human-readable description of the change.
   */
  readonly description?: string;
}

// =============================================================================
// SCHEMA MIGRATION HINTS
// =============================================================================

/**
 * Migration hint for a specific field.
 *
 * @remarks
 * Provides actionable information for clients to update their records.
 * Includes transformation suggestions and documentation links.
 *
 * @public
 */
export interface SchemaMigrationHint {
  /**
   * Field path to migrate (e.g., "abstract").
   */
  readonly field: string;

  /**
   * Action to take (e.g., "convert", "add", "restructure").
   */
  readonly action: 'convert' | 'add' | 'restructure' | 'remove';

  /**
   * Human-readable migration instructions.
   */
  readonly instructions: string;

  /**
   * URL to detailed migration documentation.
   */
  readonly documentationUrl?: string;

  /**
   * Example of the expected new format.
   */
  readonly example?: unknown;
}

// =============================================================================
// SCHEMA COMPATIBILITY INFO
// =============================================================================

/**
 * Detected record format type.
 *
 * @public
 */
export type DetectedSchemaFormat = 'current' | 'legacy' | 'unknown';

/**
 * Complete schema compatibility information for a record.
 *
 * @remarks
 * This is the main type returned by schema detection. It includes version info,
 * deprecated fields, and migration hints, all as optional/additive fields that
 * clients can ignore if they don't support schema evolution features.
 *
 * @public
 */
export interface SchemaCompatibilityInfo {
  /**
   * Detected schema version of the record.
   *
   * @remarks
   * May be inferred from field formats and structure. For records without
   * explicit version markers, this represents the closest matching version.
   */
  readonly schemaVersion: SchemaVersion;

  /**
   * Whether the record uses current or legacy format.
   */
  readonly detectedFormat: DetectedSchemaFormat;

  /**
   * List of fields using deprecated formats.
   */
  readonly deprecatedFields: readonly DeprecatedFieldInfo[];

  /**
   * Whether an automated migration is available.
   */
  readonly migrationAvailable: boolean;

  /**
   * Migration hints for updating the record.
   *
   * @remarks
   * Only present if migrationAvailable is true.
   */
  readonly migrationHints?: readonly SchemaMigrationHint[];
}

// =============================================================================
// API RESPONSE SCHEMA HINTS
// =============================================================================

/**
 * Schema hints to include in API responses.
 *
 * @remarks
 * These hints are additive and optional. Existing clients that don't understand
 * schema hints will simply ignore them. New clients can use them to inform
 * users about available record updates.
 *
 * **ATProto Principle:** This follows the "add fields, don't change existing"
 * rule for backward compatibility.
 *
 * @example
 * ```typescript
 * // API response with schema hints
 * {
 *   "uri": "at://did:plc:abc/pub.chive.eprint.submission/123",
 *   "value": { ... },
 *   "_schemaHints": {
 *     "schemaVersion": "1.2.0",
 *     "deprecatedFields": ["abstract"],
 *     "migrationAvailable": true,
 *     "migrationUrl": "https://docs.chive.pub/schema/migrations/abstract-richtext"
 *   }
 * }
 * ```
 *
 * @public
 */
export interface ApiSchemaHints {
  /**
   * Schema version string (e.g., "1.2.0").
   */
  readonly schemaVersion?: string;

  /**
   * List of field names using deprecated formats.
   */
  readonly deprecatedFields?: readonly string[];

  /**
   * Whether a migration is available for the deprecated formats.
   */
  readonly migrationAvailable?: boolean;

  /**
   * URL to migration documentation.
   */
  readonly migrationUrl?: string;
}

// =============================================================================
// SCHEMA DETECTION RESULT
// =============================================================================

/**
 * Result of schema format detection for a specific field.
 *
 * @public
 */
export interface FieldFormatDetection {
  /**
   * Field path that was analyzed.
   */
  readonly field: string;

  /**
   * Detected format type.
   */
  readonly format: string;

  /**
   * Whether this is the current expected format.
   */
  readonly isCurrent: boolean;

  /**
   * Additional detection metadata.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Complete result of schema detection for a record.
 *
 * @public
 */
export interface SchemaDetectionResult {
  /**
   * Overall compatibility info for the record.
   */
  readonly compatibility: SchemaCompatibilityInfo;

  /**
   * Per-field format detection results.
   */
  readonly fieldDetections: readonly FieldFormatDetection[];

  /**
   * Whether the record is fully up-to-date with current schema.
   */
  readonly isCurrentSchema: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Current schema version for pub.chive.eprint.submission.
 *
 * @remarks
 * Update this when making schema changes:
 * - 0.1.0: Initial release (includes both string abstract for legacy and RichTextBody array format)
 *
 * @public
 */
export const CURRENT_EPRINT_SCHEMA_VERSION: SchemaVersion = {
  major: 0,
  minor: 1,
  patch: 0,
};

/**
 * Base URL for schema migration documentation.
 *
 * @public
 */
export const SCHEMA_MIGRATION_DOCS_BASE_URL = 'https://docs.chive.pub/schema/migrations';
