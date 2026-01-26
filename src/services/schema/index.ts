/**
 * Schema evolution services for ATProto lexicon compatibility.
 *
 * @remarks
 * This module provides services for tracking schema versions, detecting legacy
 * formats, and generating migration hints. It follows ATProto principles:
 *
 * - Forward compatibility: Accept both old and new formats
 * - No breaking changes: Add fields, never remove or change existing ones
 * - Graceful degradation: Always normalize to current internal model
 * - User notification: Include hints in responses to encourage updates
 *
 * @example
 * ```typescript
 * import {
 *   SchemaCompatibilityService,
 *   schemaCompatibilityService,
 * } from '@/services/schema/index.js';
 *
 * // Use the singleton instance
 * const result = schemaCompatibilityService.analyzeEprintRecord(record);
 *
 * // Or create a new instance
 * const service = new SchemaCompatibilityService();
 * const detection = service.detectAbstractFormat(record.abstract);
 * ```
 *
 * @packageDocumentation
 * @public
 */

export {
  SchemaCompatibilityService,
  schemaCompatibilityService,
  type AbstractFormat,
} from './schema-compatibility.js';
