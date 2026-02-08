/**
 * Schema migration utilities for transforming records to current format.
 *
 * @remarks
 * Provides functions to transform deprecated record formats to the current schema.
 * These transformations are performed client-side before writing back to the PDS.
 *
 * Currently handles:
 * - `title` -> `titleRich`: when title contains LaTeX or special formatting
 * - `abstract`: string -> RichTextBody array
 * - `license`: plain string -> licenseUri + licenseSlug
 *
 * @packageDocumentation
 */

import type {
  TextItem as EprintTextItem,
  NodeRefItem as EprintNodeRefItem,
  LatexItem as EprintLatexItem,
} from './generated/types/pub/chive/eprint/submission';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Rich text body array item type.
 */
export type RichTextBodyItem = EprintTextItem | EprintNodeRefItem | EprintLatexItem;

/**
 * Title rich text array item type.
 *
 * @remarks
 * Titles support a subset of rich text items (text, LaTeX, node references).
 */
export type TitleRichItem = EprintTextItem | EprintNodeRefItem | EprintLatexItem;

/**
 * License mapping entry.
 *
 * @remarks
 * Maps license slugs to their URIs and display names.
 */
interface LicenseMapping {
  /** SPDX license slug */
  slug: string;
  /** AT-URI to license node in knowledge graph */
  uri: string;
  /** Human-readable display name */
  displayName: string;
}

/**
 * Migration result for a single field.
 */
export interface FieldMigrationResult {
  /** Field that was migrated */
  field: string;
  /** Original value (for logging/debugging) */
  originalFormat: string;
  /** New format after migration */
  newFormat: string;
  /** Whether migration was successful */
  success: boolean;
  /** Error message if migration failed */
  error?: string;
}

/**
 * Complete migration result for a record.
 */
export interface SchemaMigrationResult {
  /** Whether all migrations succeeded */
  success: boolean;
  /** Per-field migration results */
  fields: FieldMigrationResult[];
  /** Migrated record (if successful) */
  record?: Record<string, unknown>;
  /** Error message if migration failed */
  error?: string;
}

/**
 * Partial record shape for migration.
 *
 * @remarks
 * This type represents the minimum fields needed for schema detection
 * and migration. Actual records may have additional fields.
 */
export interface MigratableEprintRecord {
  /** Title (required) */
  title: string;
  /** Rich title with LaTeX and entity references (optional, current format) */
  titleRich?: TitleRichItem[];
  /** Abstract, may be string (legacy) or RichTextBodyItem[] (current) */
  abstract: string | RichTextBodyItem[];
  /** Plain text abstract (auto-generated) */
  abstractPlainText?: string;
  /** License slug */
  licenseSlug?: string;
  /** License URI */
  licenseUri?: string;
  /** All other fields */
  [key: string]: unknown;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * License slug to URI mappings.
 *
 * @remarks
 * These URIs point to license nodes in the Chive knowledge graph.
 * The governance PDS DID is `did:plc:chive-governance` (placeholder).
 */
const LICENSE_MAPPINGS: Record<string, LicenseMapping> = {
  'CC-BY-4.0': {
    slug: 'CC-BY-4.0',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.node/fc58b045-e186-5081-b7eb-abc5c47ea8a3',
    displayName: 'Creative Commons Attribution 4.0',
  },
  'CC-BY-SA-4.0': {
    slug: 'CC-BY-SA-4.0',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.node/f841cd13-ec16-50c7-afa2-852f784ca28c',
    displayName: 'Creative Commons Attribution ShareAlike 4.0',
  },
  'CC0-1.0': {
    slug: 'CC0-1.0',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.node/509414c0-d77f-5053-a774-61fe1bf97dca',
    displayName: 'Creative Commons Zero 1.0',
  },
  MIT: {
    slug: 'MIT',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.node/c8989feb-d5a7-587c-bb34-64c80013d5e3',
    displayName: 'MIT License',
  },
  'Apache-2.0': {
    slug: 'Apache-2.0',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.node/bd157693-3e6f-5ae4-ac1a-c924e86efca3',
    displayName: 'Apache License 2.0',
  },
};

// =============================================================================
// ABSTRACT MIGRATION
// =============================================================================

/**
 * Converts a plain string abstract to a RichTextBody array.
 *
 * @param abstract - Plain text abstract string
 * @returns RichTextBody array with a single text item
 *
 * @example
 * ```typescript
 * const richAbstract = migrateAbstractToRichText('This is my abstract.');
 * // Returns: [{ type: 'text', content: 'This is my abstract.' }]
 * ```
 */
export function migrateAbstractToRichText(abstract: string): RichTextBodyItem[] {
  if (!abstract || typeof abstract !== 'string') {
    return [];
  }

  const textItem: EprintTextItem = {
    $type: 'pub.chive.eprint.submission#textItem',
    type: 'text',
    content: abstract,
  };

  return [textItem];
}

/**
 * Checks if an abstract is in the legacy string format.
 *
 * @param abstract - Abstract value from record
 * @returns True if abstract is a plain string (legacy format)
 */
export function isLegacyAbstractFormat(abstract: unknown): abstract is string {
  return typeof abstract === 'string';
}

/**
 * Checks if an abstract is in the current array format.
 *
 * @param abstract - Abstract value from record
 * @returns True if abstract is a valid RichTextBody array
 */
export function isCurrentAbstractFormat(abstract: unknown): abstract is RichTextBodyItem[] {
  if (!Array.isArray(abstract)) {
    return false;
  }

  // Empty array is valid
  if (abstract.length === 0) {
    return true;
  }

  // Check that all items have valid structure
  return abstract.every((item) => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    const typed = item as { type?: unknown };
    return typed.type === 'text' || typed.type === 'nodeRef';
  });
}

// =============================================================================
// TITLE MIGRATION
// =============================================================================

/**
 * Regular expressions for detecting LaTeX markers in titles.
 *
 * @remarks
 * These patterns detect common LaTeX constructs that indicate a title
 * would benefit from rich text formatting.
 */
const LATEX_PATTERNS = [
  /\$[^$]+\$/, // Inline math: $...$
  /\$\$[^$]+\$\$/, // Display math: $$...$$
  /\\frac\{/, // Fractions
  /\\sum/, // Summation
  /\\int/, // Integral
  /\\prod/, // Product
  /\\lim/, // Limit
  /\\sqrt/, // Square root
  /\\[a-zA-Z]+\{/, // Generic LaTeX commands with braces
  /\\alpha|\\beta|\\gamma|\\delta|\\epsilon|\\theta|\\lambda|\\mu|\\pi|\\sigma|\\omega/, // Greek letters
  /\\infty/, // Infinity
  /\\partial/, // Partial derivative
  /\\nabla/, // Nabla/del operator
  /\^{[^}]+}/, // Superscript with braces
  /_{[^}]+}/, // Subscript with braces
  /\\mathbb\{/, // Blackboard bold
  /\\mathcal\{/, // Calligraphic
  /\\mathrm\{/, // Roman text in math
  /\\text\{/, // Text in math mode
];

/**
 * Checks if a title contains LaTeX or special formatting markers.
 *
 * @param title - Plain text title string
 * @returns True if the title contains LaTeX or formatting that should be preserved
 *
 * @example
 * ```typescript
 * isLegacyTitleFormat('Simple Title'); // false
 * isLegacyTitleFormat('Analysis of $\\alpha$-decay'); // true
 * isLegacyTitleFormat('A \\frac{1}{2} approach'); // true
 * ```
 */
export function isLegacyTitleFormat(title: string, titleRich?: TitleRichItem[]): boolean {
  // If titleRich already exists, no migration needed
  if (titleRich && Array.isArray(titleRich) && titleRich.length > 0) {
    return false;
  }

  // Check if title contains any LaTeX markers
  if (!title || typeof title !== 'string') {
    return false;
  }

  return LATEX_PATTERNS.some((pattern) => pattern.test(title));
}

/**
 * Converts a plain title with LaTeX to a rich text array.
 *
 * @param title - Plain text title with potential LaTeX content
 * @returns TitleRichItem array with text and LaTeX items separated
 *
 * @remarks
 * This function parses the title and separates LaTeX expressions into
 * dedicated `latexItem` elements. Text outside LaTeX delimiters becomes
 * `textItem` elements.
 *
 * @example
 * ```typescript
 * const richTitle = migrateTitleToRichText('Study of $\\alpha$-particles');
 * // Returns: [
 * //   { type: 'text', content: 'Study of ' },
 * //   { type: 'latex', content: '\\alpha', displayMode: false },
 * //   { type: 'text', content: '-particles' }
 * // ]
 * ```
 */
export function migrateTitleToRichText(title: string): TitleRichItem[] {
  if (!title || typeof title !== 'string') {
    return [];
  }

  const result: TitleRichItem[] = [];

  // Pattern to match both inline ($...$) and display ($$...$$) math
  // Display mode must be matched first to avoid partial matches
  const mathPattern = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathPattern.exec(title)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textContent = title.slice(lastIndex, match.index);
      if (textContent) {
        result.push({
          $type: 'pub.chive.eprint.submission#textItem',
          type: 'text',
          content: textContent,
        } as EprintTextItem);
      }
    }

    // Determine if display or inline mode and get the content
    const isDisplayMode = match[1] !== undefined;
    const latexContent = isDisplayMode ? match[1] : match[2];

    if (latexContent) {
      result.push({
        $type: 'pub.chive.eprint.submission#latexItem',
        type: 'latex',
        content: latexContent,
        displayMode: isDisplayMode,
      } as EprintLatexItem);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < title.length) {
    const textContent = title.slice(lastIndex);
    if (textContent) {
      result.push({
        $type: 'pub.chive.eprint.submission#textItem',
        type: 'text',
        content: textContent,
      } as EprintTextItem);
    }
  }

  // If no LaTeX was found, return a single text item
  if (result.length === 0) {
    result.push({
      $type: 'pub.chive.eprint.submission#textItem',
      type: 'text',
      content: title,
    } as EprintTextItem);
  }

  return result;
}

// =============================================================================
// LICENSE MIGRATION
// =============================================================================

/**
 * Converts a license slug to a structured license with URI.
 *
 * @param licenseSlug - SPDX license identifier (e.g., 'CC-BY-4.0')
 * @returns Object with licenseSlug and licenseUri, or just slug if no mapping
 *
 * @example
 * ```typescript
 * const license = migrateLicenseToNode('CC-BY-4.0');
 * // Returns: {
 * //   licenseSlug: 'CC-BY-4.0',
 * //   licenseUri: 'at://did:plc:chive-governance/pub.chive.graph.node/fc58b045-e186-5081-b7eb-abc5c47ea8a3'
 * // }
 * ```
 */
export function migrateLicenseToNode(licenseSlug: string): {
  licenseSlug: string;
  licenseUri?: string;
} {
  const mapping = LICENSE_MAPPINGS[licenseSlug];

  if (mapping) {
    return {
      licenseSlug: mapping.slug,
      licenseUri: mapping.uri,
    };
  }

  // Unknown license, keep the slug without URI
  return {
    licenseSlug,
  };
}

/**
 * Checks if a record has a license URI set.
 *
 * @param record - Record to check
 * @returns True if licenseUri is already set
 */
export function hasLicenseUri(record: MigratableEprintRecord): boolean {
  return typeof record.licenseUri === 'string' && record.licenseUri.length > 0;
}

/**
 * Gets the display name for a license slug.
 *
 * @param slug - SPDX license identifier
 * @returns Human-readable license name
 */
export function getLicenseDisplayName(slug: string): string {
  return LICENSE_MAPPINGS[slug]?.displayName ?? slug;
}

// =============================================================================
// FULL RECORD MIGRATION
// =============================================================================

/**
 * Transforms a record to the current schema format.
 *
 * @param record - Record with potentially deprecated fields
 * @returns Migration result with transformed record
 *
 * @remarks
 * This function:
 * 1. Detects which fields use deprecated formats
 * 2. Transforms each deprecated field to the current format
 * 3. Preserves all other fields unchanged
 * 4. Returns a result object with the migrated record and field-level status
 *
 * The function does not modify the input record; it returns a new object.
 *
 * @example
 * ```typescript
 * const result = transformToCurrentSchema({
 *   title: 'My Paper',
 *   abstract: 'This is my abstract', // Legacy string format
 *   licenseSlug: 'CC-BY-4.0', // Missing licenseUri
 *   // ... other fields
 * });
 *
 * if (result.success) {
 *   // result.record contains the migrated record
 *   await putRecord(uri, result.record);
 * }
 * ```
 */
export function transformToCurrentSchema(record: MigratableEprintRecord): SchemaMigrationResult {
  const fields: FieldMigrationResult[] = [];
  const migratedRecord = { ...record };

  // Migrate title if it contains LaTeX but has no titleRich
  if (isLegacyTitleFormat(record.title, record.titleRich)) {
    try {
      const migratedTitle = migrateTitleToRichText(record.title);
      migratedRecord.titleRich = migratedTitle;

      fields.push({
        field: 'title',
        originalFormat: 'plain-string-with-latex',
        newFormat: 'TitleRichItem[]',
        success: true,
      });
    } catch (err) {
      fields.push({
        field: 'title',
        originalFormat: 'plain-string-with-latex',
        newFormat: 'TitleRichItem[]',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Migrate abstract if in legacy string format
  if (isLegacyAbstractFormat(record.abstract)) {
    try {
      const migratedAbstract = migrateAbstractToRichText(record.abstract);
      migratedRecord.abstract = migratedAbstract;

      // Set abstractPlainText if not already set
      if (!migratedRecord.abstractPlainText) {
        migratedRecord.abstractPlainText = record.abstract;
      }

      fields.push({
        field: 'abstract',
        originalFormat: 'string',
        newFormat: 'RichTextBody[]',
        success: true,
      });
    } catch (err) {
      fields.push({
        field: 'abstract',
        originalFormat: 'string',
        newFormat: 'RichTextBody[]',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Migrate license if licenseUri is missing but licenseSlug is present
  if (record.licenseSlug && !hasLicenseUri(record)) {
    try {
      const migratedLicense = migrateLicenseToNode(record.licenseSlug);
      migratedRecord.licenseSlug = migratedLicense.licenseSlug;
      if (migratedLicense.licenseUri) {
        migratedRecord.licenseUri = migratedLicense.licenseUri;
      }

      fields.push({
        field: 'license',
        originalFormat: 'slug-only',
        newFormat: 'slug+uri',
        success: true,
      });
    } catch (err) {
      fields.push({
        field: 'license',
        originalFormat: 'slug-only',
        newFormat: 'slug+uri',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Check if all migrations succeeded
  const allSucceeded = fields.every((f) => f.success);
  const success = fields.length === 0 || allSucceeded;

  // Only return the migrated record if there were fields to migrate and all succeeded
  const hasChanges = fields.length > 0 && allSucceeded;

  return {
    success,
    fields,
    record: hasChanges ? migratedRecord : undefined,
    error: success ? undefined : 'One or more field migrations failed',
  };
}

/**
 * Detects which fields in a record need migration.
 *
 * @param record - Record to analyze
 * @returns Array of field names that need migration
 *
 * @example
 * ```typescript
 * const fieldsToMigrate = detectFieldsNeedingMigration(record);
 * // Returns: ['title', 'abstract', 'license']
 * ```
 */
export function detectFieldsNeedingMigration(record: MigratableEprintRecord): string[] {
  const fields: string[] = [];

  // Check title format (LaTeX in plain title without titleRich)
  if (isLegacyTitleFormat(record.title, record.titleRich)) {
    fields.push('title');
  }

  // Check abstract format
  if (isLegacyAbstractFormat(record.abstract)) {
    fields.push('abstract');
  }

  // Check license format
  if (record.licenseSlug && !hasLicenseUri(record)) {
    fields.push('license');
  }

  return fields;
}

/**
 * Checks if a record needs any schema migration.
 *
 * @param record - Record to check
 * @returns True if any fields use deprecated formats
 */
export function needsSchemaMigration(record: MigratableEprintRecord): boolean {
  return detectFieldsNeedingMigration(record).length > 0;
}
