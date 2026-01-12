/**
 * Content extraction services for document processing.
 *
 * @packageDocumentation
 * @public
 */

export {
  detectFormat,
  detectFormatFromFile,
  isManuscriptFormat,
  getSupportedManuscriptMimeTypes,
  getSupportedManuscriptExtensions,
  type DetectedFormat,
  type DetectionConfidence,
} from './format-detector.js';

export {
  extractDocument,
  extractMetadataOnly,
  type ExtractedDocument,
  type DocumentStructure,
  type DocumentMetadata,
  type ExtractionOptions,
  type Heading,
  type Paragraph,
  type CodeBlock,
  type Table,
  type PageBoundary,
} from './document-extractor.js';
