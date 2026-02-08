/**
 * Document location utilities for the enhanced review card feature.
 *
 * Provides functions to extract, format, and display location information
 * from review targets for different document formats (PDF, Jupyter, etc.).
 *
 * @module
 */

import type { Review } from '../api/schema.js';
import type { DocumentFormat } from '../api/generated/types/pub/chive/defs.js';

// =============================================================================
// LOCATION INFO TYPES
// =============================================================================

/**
 * Discriminated union for different document location types.
 *
 * Each variant represents a specific way to identify a location within
 * a document based on its format.
 */
export type LocationInfo =
  | { type: 'page'; pageNumber: number }
  | { type: 'section'; sectionId: string; sectionLabel?: string }
  | { type: 'cell'; cellId: string; cellNumber?: number }
  | { type: 'line'; lineNumber: number }
  | { type: 'position'; start: number; end: number };

// =============================================================================
// EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extracts location information from a review target.
 *
 * Uses the document format to determine how to interpret the refinedBy
 * selector data, then extracts the appropriate location type.
 *
 * @param target - the review target containing source and refinedBy selector
 * @param format - optional document format to determine extraction strategy
 * @returns location information or null if no location data is available
 *
 * @example
 * ```typescript
 * const location = extractLocationInfo(review.target, 'pdf');
 * if (location?.type === 'page') {
 *   console.log(`Found on page ${location.pageNumber}`);
 * }
 * ```
 */
export function extractLocationInfo(
  target: Review['target'] | undefined,
  format?: DocumentFormat
): LocationInfo | null {
  if (!target) {
    return null;
  }

  const refinedBy = target.refinedBy;

  // Check for page number (PDF format)
  // Page numbers are stored 0-indexed, convert to 1-indexed for display
  if (format === 'pdf' && refinedBy?.pageNumber !== undefined) {
    return { type: 'page', pageNumber: refinedBy.pageNumber + 1 };
  }

  // Check for page field on target directly (legacy support)
  // Also stored 0-indexed, convert to 1-indexed
  if (format === 'pdf' && target.page !== undefined) {
    return { type: 'page', pageNumber: target.page + 1 };
  }

  // Check for Jupyter cell (cellId or cellNumber from custom fields)
  // Jupyter notebooks use cell identifiers
  if (format === 'jupyter') {
    // Look for cell information in refinedBy or target
    // The refinedBy may contain cellId/cellNumber in extended fields
    const refinedByAny = refinedBy as unknown as Record<string, unknown> | undefined;
    if (refinedByAny?.cellId !== undefined) {
      return {
        type: 'cell',
        cellId: String(refinedByAny.cellId),
        cellNumber:
          typeof refinedByAny.cellNumber === 'number' ? refinedByAny.cellNumber : undefined,
      };
    }
  }

  // Check for line number (plain text format)
  if (format === 'txt') {
    const refinedByAny = refinedBy as unknown as Record<string, unknown> | undefined;
    if (typeof refinedByAny?.lineNumber === 'number') {
      return { type: 'line', lineNumber: refinedByAny.lineNumber };
    }
  }

  // Check for section (HTML, Markdown, LaTeX)
  if (format === 'html' || format === 'markdown' || format === 'latex') {
    const refinedByAny = refinedBy as unknown as Record<string, unknown> | undefined;
    if (typeof refinedByAny?.sectionId === 'string') {
      return {
        type: 'section',
        sectionId: refinedByAny.sectionId,
        sectionLabel:
          typeof refinedByAny.sectionLabel === 'string' ? refinedByAny.sectionLabel : undefined,
      };
    }
  }

  // Fall back to start/end position if available
  if (refinedBy?.start !== undefined && refinedBy?.end !== undefined) {
    return { type: 'position', start: refinedBy.start, end: refinedBy.end };
  }

  return null;
}

// =============================================================================
// FORMATTING FUNCTIONS
// =============================================================================

/**
 * Formats location information into a human-readable label.
 *
 * @param location - the location information to format
 * @returns a human-readable string describing the location
 *
 * @example
 * ```typescript
 * const label = formatLocationLabel({ type: 'page', pageNumber: 5 });
 * // Returns: "Page 5"
 *
 * const cellLabel = formatLocationLabel({ type: 'cell', cellId: 'abc', cellNumber: 3 });
 * // Returns: "Cell 3"
 * ```
 */
export function formatLocationLabel(location: LocationInfo): string {
  switch (location.type) {
    case 'page':
      return `Page ${location.pageNumber}`;
    case 'cell':
      if (location.cellNumber !== undefined) {
        return `Cell ${location.cellNumber}`;
      }
      return `Cell ${location.cellId}`;
    case 'line':
      return `Line ${location.lineNumber}`;
    case 'section':
      if (location.sectionLabel) {
        return `Section: ${location.sectionLabel}`;
      }
      return `Section: ${location.sectionId}`;
    case 'position':
      return `Position ${location.start}-${location.end}`;
  }
}

/**
 * Returns an appropriate button label for navigating to a document location.
 *
 * @param format - the document format to determine the button label
 * @returns a button label string appropriate for the format
 *
 * @example
 * ```typescript
 * const label = getGoToButtonLabel('pdf');
 * // Returns: "Go to PDF"
 *
 * const jupyterLabel = getGoToButtonLabel('jupyter');
 * // Returns: "Go to Cell"
 * ```
 */
export function getGoToButtonLabel(format?: DocumentFormat): string {
  switch (format) {
    case 'pdf':
      return 'Go to PDF';
    case 'jupyter':
      return 'Go to Cell';
    case 'txt':
      return 'Go to Line';
    case 'html':
    case 'markdown':
    case 'latex':
      return 'Go to Section';
    default:
      return 'Go to Location';
  }
}
