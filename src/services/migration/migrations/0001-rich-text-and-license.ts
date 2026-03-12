/**
 * Migration 0001: Rich text formats and license URIs.
 *
 * Converts legacy eprint record fields to the v0.2.0 schema:
 * - abstract: plain string -> RichTextItem[] array
 * - title: LaTeX in plain string -> titleRich[] array
 * - license: slug-only -> slug + governance PDS URI
 *
 * Affects:
 * - pub.chive.eprint.submission (rev 1 -> 2)
 *
 * @packageDocumentation
 */

import { registerMigration } from '../record-migrator.js';

// =============================================================================
// LATEX DETECTION
// =============================================================================

const LATEX_PATTERNS = [
  /\$[^$]+\$/,
  /\$\$[^$]+\$\$/,
  /\\frac\{/,
  /\\sum/,
  /\\int/,
  /\\prod/,
  /\\lim/,
  /\\sqrt/,
  /\\[a-zA-Z]+\{/,
  /\\alpha|\\beta|\\gamma|\\delta|\\epsilon|\\theta|\\lambda|\\mu|\\pi|\\sigma|\\omega/,
  /\\infty/,
  /\\partial/,
  /\\nabla/,
  /\^{[^}]+}/,
  /_{[^}]+}/,
  /\\mathbb\{/,
  /\\mathcal\{/,
  /\\mathrm\{/,
  /\\text\{/,
];

function containsLatex(text: string): boolean {
  return LATEX_PATTERNS.some((pattern) => pattern.test(text));
}

// =============================================================================
// TITLE PARSER
// =============================================================================

interface RichTextItem {
  $type?: string;
  type: string;
  content: string;
  displayMode?: boolean;
}

function parseTitleToRichText(title: string): RichTextItem[] {
  const result: RichTextItem[] = [];
  const mathPattern = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathPattern.exec(title)) !== null) {
    if (match.index > lastIndex) {
      const textContent = title.slice(lastIndex, match.index);
      if (textContent) {
        result.push({
          $type: 'pub.chive.richtext.defs#textItem',
          type: 'text',
          content: textContent,
        });
      }
    }

    const isDisplayMode = match[1] !== undefined;
    const latexContent = isDisplayMode ? match[1] : match[2];

    if (latexContent) {
      result.push({
        $type: 'pub.chive.richtext.defs#latexItem',
        type: 'latex',
        content: latexContent,
        displayMode: isDisplayMode,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < title.length) {
    const textContent = title.slice(lastIndex);
    if (textContent) {
      result.push({
        $type: 'pub.chive.richtext.defs#textItem',
        type: 'text',
        content: textContent,
      });
    }
  }

  if (result.length === 0) {
    result.push({
      $type: 'pub.chive.richtext.defs#textItem',
      type: 'text',
      content: title,
    });
  }

  return result;
}

// =============================================================================
// LICENSE MAPPINGS
// =============================================================================

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
// MIGRATION
// =============================================================================

registerMigration({
  lexicon: 'pub.chive.eprint.submission',
  fromRevision: 1,
  toRevision: 2,
  description:
    'Convert abstract to rich text array, add titleRich for LaTeX titles, add license URI',
  migrate: (record) => {
    const result: Record<string, unknown> = { ...record };

    // Abstract: string -> RichTextItem[]
    if (typeof record.abstract === 'string') {
      result.abstract = [
        {
          $type: 'pub.chive.richtext.defs#textItem',
          type: 'text',
          content: record.abstract,
        },
      ];
      if (!record.abstractPlainText) {
        result.abstractPlainText = record.abstract;
      }
    }

    // Title: add titleRich if title contains LaTeX and no titleRich exists
    if (
      typeof record.title === 'string' &&
      containsLatex(record.title) &&
      !Array.isArray(record.titleRich)
    ) {
      result.titleRich = parseTitleToRichText(record.title);
    }

    // License: add URI from slug mapping
    const slug = (record.licenseSlug ?? record.license) as string | undefined;
    if (slug && !record.licenseUri) {
      const uri = LICENSE_URI_MAP[slug] ?? LICENSE_URI_MAP[slug.toUpperCase()];
      if (uri) {
        result.licenseUri = uri;
        // Normalize field name: license -> licenseSlug
        if (record.license && !record.licenseSlug) {
          result.licenseSlug = record.license;
          delete result.license;
        }
      }
    }

    return result;
  },
});
