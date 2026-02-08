/**
 * Eprint schema migrations.
 *
 * @remarks
 * Defines all migrations for the `pub.chive.eprint.submission` collection.
 * Each migration transforms records from one schema version to the next.
 *
 * @packageDocumentation
 */

import type { SchemaMigration } from './types';
import { migrationRegistry } from './registry';

// =============================================================================
// COLLECTION CONSTANT
// =============================================================================

/**
 * Collection NSID for eprint submissions.
 */
const EPRINT_COLLECTION = 'pub.chive.eprint.submission';

// =============================================================================
// TYPES FOR MIGRATION
// =============================================================================

/**
 * Rich text item for abstracts and titles.
 */
interface TextItem {
  $type?: string;
  type: 'text';
  content: string;
}

/**
 * LaTeX item for mathematical content.
 */
interface LatexItem {
  $type?: string;
  type: 'latex';
  content: string;
  displayMode?: boolean;
}

/**
 * Node reference item for knowledge graph references.
 */
interface NodeRefItem {
  $type?: string;
  type: 'nodeRef';
  uri: string;
  label?: string;
  subkind?: string;
}

/**
 * Rich text body item (union of all item types).
 */
type RichTextItem = TextItem | LatexItem | NodeRefItem | { type: string };

/**
 * Eprint record with legacy string abstract.
 */
interface LegacyAbstractEprint {
  abstract: string;
  abstractPlainText?: string;
  [key: string]: unknown;
}

/**
 * Eprint record with legacy title format (LaTeX in plain string).
 */
interface LegacyTitleEprint {
  title: string;
  titleRich?: undefined;
  [key: string]: unknown;
}

/**
 * Eprint record with legacy license format (slug only).
 */
interface LegacyLicenseEprint {
  licenseSlug: string;
  licenseUri?: undefined | '';
  [key: string]: unknown;
}

// =============================================================================
// LATEX DETECTION PATTERNS
// =============================================================================

/**
 * Patterns that indicate LaTeX content in a title.
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
  /\\alpha|\\beta|\\gamma|\\delta|\\epsilon|\\theta|\\lambda|\\mu|\\pi|\\sigma|\\omega/,
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
 * Checks if text contains LaTeX markers.
 */
function containsLatex(text: string): boolean {
  return LATEX_PATTERNS.some((pattern) => pattern.test(text));
}

// =============================================================================
// LICENSE MAPPINGS
// =============================================================================

/**
 * Maps license slugs to their governance PDS URIs.
 */
const LICENSE_URI_MAP: Record<string, string> = {
  'CC-BY-4.0':
    'at://did:plc:chive-governance/pub.chive.graph.node/fc58b045-e186-5081-b7eb-abc5c47ea8a3',
  'CC-BY-SA-4.0':
    'at://did:plc:chive-governance/pub.chive.graph.node/f841cd13-ec16-50c7-afa2-852f784ca28c',
  'CC0-1.0':
    'at://did:plc:chive-governance/pub.chive.graph.node/509414c0-d77f-5053-a774-61fe1bf97dca',
  MIT: 'at://did:plc:chive-governance/pub.chive.graph.node/c8989feb-d5a7-587c-bb34-64c80013d5e3',
  'Apache-2.0':
    'at://did:plc:chive-governance/pub.chive.graph.node/bd157693-3e6f-5ae4-ac1a-c924e86efca3',
};

// =============================================================================
// ABSTRACT MIGRATION
// =============================================================================

/**
 * Migration: Convert plain string abstract to rich text array.
 *
 * @remarks
 * Version 0.1.0 stored abstracts as plain strings. Version 0.2.0 changed
 * to a rich text array format supporting formatting, entity references,
 * and LaTeX.
 */
const abstractStringToRichTextMigration: SchemaMigration = {
  id: 'eprint-abstract-string-to-rich-text',
  fromVersion: '0.1.0',
  toVersion: '0.2.0',
  collection: EPRINT_COLLECTION,
  description: 'Converts plain text abstract to rich text format for better formatting support',
  priority: 10,

  needsMigration: (record): boolean => {
    if (typeof record !== 'object' || record === null) {
      return false;
    }
    const rec = record as Record<string, unknown>;
    return typeof rec.abstract === 'string';
  },

  migrate: (old: unknown): unknown => {
    const record = old as LegacyAbstractEprint;
    const textItem: TextItem = {
      $type: 'pub.chive.eprint.submission#textItem',
      type: 'text',
      content: record.abstract,
    };

    return {
      ...record,
      abstract: [textItem],
      abstractPlainText: record.abstractPlainText ?? record.abstract,
    };
  },

  confirmationMessage:
    'Your abstract will be converted to a rich text format, enabling better formatting and entity references.',
};

// =============================================================================
// TITLE MIGRATION
// =============================================================================

/**
 * Migration: Convert title with LaTeX to rich text array.
 *
 * @remarks
 * Titles containing LaTeX expressions (e.g., $\alpha$) are converted to
 * a rich text array with separate text and LaTeX items.
 */
const titleLatexToRichTextMigration: SchemaMigration = {
  id: 'eprint-title-latex-to-rich-text',
  fromVersion: '0.1.0',
  toVersion: '0.2.0',
  collection: EPRINT_COLLECTION,
  description: 'Converts title with LaTeX to rich text format for proper math rendering',
  priority: 20,

  needsMigration: (record): boolean => {
    if (typeof record !== 'object' || record === null) {
      return false;
    }
    const rec = record as Record<string, unknown>;

    // Already has titleRich
    if (Array.isArray(rec.titleRich) && rec.titleRich.length > 0) {
      return false;
    }

    // Check if title contains LaTeX
    if (typeof rec.title !== 'string') {
      return false;
    }

    return containsLatex(rec.title);
  },

  migrate: (old: unknown): unknown => {
    const record = old as LegacyTitleEprint;
    const titleRich = parseTitleToRichText(record.title);

    return {
      ...record,
      titleRich,
    };
  },

  confirmationMessage:
    'Your title contains mathematical notation that will be converted for proper rendering.',
};

/**
 * Parses a title string into rich text items.
 *
 * @param title - plain title string potentially containing LaTeX
 * @returns array of rich text items
 */
function parseTitleToRichText(title: string): RichTextItem[] {
  const result: RichTextItem[] = [];

  // Pattern to match both inline ($...$) and display ($$...$$) math
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
        });
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
      });
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
      });
    }
  }

  // If no LaTeX was found, return a single text item
  if (result.length === 0) {
    result.push({
      $type: 'pub.chive.eprint.submission#textItem',
      type: 'text',
      content: title,
    });
  }

  return result;
}

// =============================================================================
// LICENSE MIGRATION
// =============================================================================

/**
 * Migration: Add license URI from slug.
 *
 * @remarks
 * Older records have only a license slug. This migration adds the
 * corresponding knowledge graph URI for the license.
 */
const licenseSlugToUriMigration: SchemaMigration = {
  id: 'eprint-license-slug-to-uri',
  fromVersion: '0.1.0',
  toVersion: '0.2.0',
  collection: EPRINT_COLLECTION,
  description: 'Links license to knowledge graph for better metadata',
  priority: 30,

  needsMigration: (record): boolean => {
    if (typeof record !== 'object' || record === null) {
      return false;
    }
    const rec = record as Record<string, unknown>;

    // Has slug but no URI
    if (typeof rec.licenseSlug !== 'string' || !rec.licenseSlug) {
      return false;
    }

    // Already has a URI
    if (typeof rec.licenseUri === 'string' && rec.licenseUri.length > 0) {
      return false;
    }

    // Check if we have a mapping for this slug
    return rec.licenseSlug in LICENSE_URI_MAP;
  },

  migrate: (old: unknown): unknown => {
    const record = old as LegacyLicenseEprint;
    const uri = LICENSE_URI_MAP[record.licenseSlug];

    return {
      ...record,
      licenseUri: uri ?? '',
    };
  },

  confirmationMessage:
    'Your license will be linked to the Chive knowledge graph for improved discoverability.',
};

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * All eprint migrations.
 */
export const eprintMigrations: readonly SchemaMigration[] = [
  abstractStringToRichTextMigration,
  titleLatexToRichTextMigration,
  licenseSlugToUriMigration,
];

/**
 * Registers all eprint migrations with the global registry.
 *
 * @remarks
 * Call this during application initialization to enable eprint migrations.
 */
export function registerEprintMigrations(): void {
  for (const migration of eprintMigrations) {
    try {
      migrationRegistry.register(migration);
    } catch {
      // Already registered (e.g., in HMR scenarios)
    }
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

export { containsLatex, parseTitleToRichText, LICENSE_URI_MAP };
