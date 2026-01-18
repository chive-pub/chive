/**
 * Utility functions for Chive frontend.
 *
 * @remarks
 * Re-exports all utility modules for convenient imports.
 *
 * @packageDocumentation
 */

// Date formatting utilities
export { formatDate, formatDateRange, formatISODate, type FormatDateOptions } from './format-date';

// Number formatting utilities
export {
  formatCompactNumber,
  formatNumber,
  formatPercentage,
  formatMetric,
  formatFileSize,
  formatHIndex,
} from './format-number';

// AT Protocol utilities
export {
  parseAtUri,
  buildAtUri,
  isValidAtUri,
  extractDid,
  extractCollection,
  extractRkey,
  encodeAtUriForPath,
  decodeAtUriFromPath,
  buildBlobUrl,
  isValidDid,
  shortenDid,
  type ParsedAtUri,
} from './atproto';

// Annotation serialization utilities
export {
  serializeToBody,
  renderBodyToHTML,
  escapeHTML,
  createChipHTML,
  createChipElement,
  extractPlainText,
  getTextLength,
  isWithinMaxLength,
  hasContent,
  type ChipData,
} from './annotation-serializer';
