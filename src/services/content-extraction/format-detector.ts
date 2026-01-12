/**
 * Document format detection service using magic bytes.
 *
 * @remarks
 * Detects document format from file content (magic bytes), MIME type headers,
 * and filename extensions. Uses the `file-type` library for reliable detection.
 *
 * Detection order (by confidence):
 * 1. Magic bytes (highest confidence)
 * 2. MIME type header (medium confidence)
 * 3. File extension (lowest confidence)
 *
 * @packageDocumentation
 * @public
 * @since 0.2.0
 */

import { extname, basename } from 'path';

import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';

import type { DocumentFormat, SupplementaryCategory } from '../../types/models/preprint.js';

/**
 * Confidence level for format detection.
 *
 * @public
 */
export type DetectionConfidence = 'high' | 'medium' | 'low';

/**
 * Result of format detection.
 *
 * @public
 */
export interface DetectedFormat {
  /**
   * Detected document format (may be any file extension for non-manuscript files).
   */
  readonly format: string;

  /**
   * Detected MIME type.
   */
  readonly mimeType: string;

  /**
   * File extension (without dot).
   */
  readonly extension: string;

  /**
   * Confidence level of detection.
   */
  readonly confidence: DetectionConfidence;

  /**
   * Inferred supplementary category (for non-manuscript files).
   */
  readonly category?: SupplementaryCategory;

  /**
   * Whether this is a primary manuscript format.
   */
  readonly isManuscriptFormat: boolean;
}

/**
 * MIME type to DocumentFormat mapping.
 */
const MIME_TO_FORMAT: ReadonlyMap<string, DocumentFormat> = new Map([
  // Tier 1 - Essential (95%+ of submissions)
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['text/html', 'html'],
  ['text/markdown', 'markdown'],
  ['text/x-markdown', 'markdown'],

  // Tier 2 - Important (40%+ in specialized fields)
  ['text/x-tex', 'latex'],
  ['application/x-tex', 'latex'],
  ['application/x-latex', 'latex'],
  ['application/x-ipynb+json', 'jupyter'],
  ['application/vnd.oasis.opendocument.text', 'odt'],

  // Tier 3 - Supplementary formats
  ['application/rtf', 'rtf'],
  ['text/rtf', 'rtf'],
  ['application/epub+zip', 'epub'],
  ['text/plain', 'txt'],
]);

/**
 * Extension to DocumentFormat mapping (fallback).
 */
const EXTENSION_TO_FORMAT: ReadonlyMap<string, DocumentFormat> = new Map([
  ['pdf', 'pdf'],
  ['docx', 'docx'],
  ['html', 'html'],
  ['htm', 'html'],
  ['md', 'markdown'],
  ['markdown', 'markdown'],
  ['tex', 'latex'],
  ['latex', 'latex'],
  ['ipynb', 'jupyter'],
  ['odt', 'odt'],
  ['rtf', 'rtf'],
  ['epub', 'epub'],
  ['txt', 'txt'],
  ['text', 'txt'],
]);

/**
 * Extension to supplementary category mapping.
 */
const EXTENSION_TO_CATEGORY: ReadonlyMap<string, SupplementaryCategory> = new Map([
  // Notebook
  ['ipynb', 'notebook'],
  ['rmd', 'notebook'],
  ['qmd', 'notebook'],

  // Dataset
  ['csv', 'dataset'],
  ['tsv', 'dataset'],
  ['xlsx', 'dataset'],
  ['xls', 'dataset'],
  ['json', 'dataset'],
  ['xml', 'dataset'],
  ['parquet', 'dataset'],

  // Code
  ['py', 'code'],
  ['r', 'code'],
  ['js', 'code'],
  ['ts', 'code'],
  ['java', 'code'],
  ['cpp', 'code'],
  ['c', 'code'],
  ['h', 'code'],
  ['hpp', 'code'],
  ['go', 'code'],
  ['rs', 'code'],
  ['m', 'code'],
  ['jl', 'code'],
  ['sh', 'code'],
  ['bash', 'code'],
  ['sql', 'code'],

  // Figure
  ['png', 'figure'],
  ['jpg', 'figure'],
  ['jpeg', 'figure'],
  ['gif', 'figure'],
  ['svg', 'figure'],
  ['tif', 'figure'],
  ['tiff', 'figure'],
  ['bmp', 'figure'],
  ['webp', 'figure'],
  ['eps', 'figure'],
  ['ai', 'figure'],
  ['psd', 'figure'],

  // Video
  ['mp4', 'video'],
  ['webm', 'video'],
  ['mov', 'video'],
  ['avi', 'video'],
  ['mkv', 'video'],

  // Audio
  ['mp3', 'audio'],
  ['wav', 'audio'],
  ['ogg', 'audio'],
  ['flac', 'audio'],

  // Presentation
  ['pptx', 'presentation'],
  ['ppt', 'presentation'],
  ['key', 'presentation'],
  ['odp', 'presentation'],
]);

/**
 * Document formats that are valid for primary manuscripts.
 */
const MANUSCRIPT_FORMATS: ReadonlySet<DocumentFormat> = new Set([
  'pdf',
  'docx',
  'html',
  'markdown',
  'latex',
  'jupyter',
  'odt',
  'rtf',
  'epub',
  'txt',
]);

/**
 * Detects format from buffer using magic bytes.
 *
 * @param buffer - File content as Uint8Array
 * @param filename - Original filename (for extension fallback)
 * @param mimeType - MIME type header (for secondary fallback)
 * @returns Detected format with confidence level
 *
 * @example
 * ```typescript
 * const buffer = await readFile('paper.pdf');
 * const detected = await detectFormat(buffer, 'paper.pdf');
 * console.log(detected.format); // 'pdf'
 * console.log(detected.confidence); // 'high'
 * ```
 *
 * @public
 */
export async function detectFormat(
  buffer: Uint8Array,
  filename?: string,
  mimeType?: string
): Promise<DetectedFormat> {
  // Strategy 1: Magic bytes detection (highest confidence)
  const fileType = await fileTypeFromBuffer(buffer);
  if (fileType) {
    const format = MIME_TO_FORMAT.get(fileType.mime);
    if (format) {
      return {
        format,
        mimeType: fileType.mime,
        extension: fileType.ext,
        confidence: 'high',
        category: inferCategoryFromExtension(fileType.ext, filename),
        isManuscriptFormat: MANUSCRIPT_FORMATS.has(format),
      };
    }

    // Known file type but not a manuscript format
    return {
      format: fileType.ext,
      mimeType: fileType.mime,
      extension: fileType.ext,
      confidence: 'high',
      category: inferCategoryFromExtension(fileType.ext, filename),
      isManuscriptFormat: false,
    };
  }

  // Strategy 2: MIME type header (medium confidence)
  if (mimeType) {
    const format = MIME_TO_FORMAT.get(mimeType);
    const ext = filename ? normalizeExtension(extname(filename)) : '';
    if (format) {
      return {
        format,
        mimeType,
        extension: ext,
        confidence: 'medium',
        category: inferCategoryFromExtension(ext, filename),
        isManuscriptFormat: MANUSCRIPT_FORMATS.has(format),
      };
    }
  }

  // Strategy 3: File extension (lowest confidence)
  if (filename) {
    const ext = normalizeExtension(extname(filename));
    const format = EXTENSION_TO_FORMAT.get(ext);
    if (format) {
      const inferredMime = getMimeTypeForFormat(format);
      return {
        format,
        mimeType: mimeType ?? inferredMime,
        extension: ext,
        confidence: 'low',
        category: inferCategoryFromExtension(ext, filename),
        isManuscriptFormat: MANUSCRIPT_FORMATS.has(format),
      };
    }

    // Unknown format - return extension as format
    return {
      format: ext || 'unknown',
      mimeType: mimeType ?? 'application/octet-stream',
      extension: ext || '',
      confidence: 'low',
      category: inferCategoryFromExtension(ext, filename),
      isManuscriptFormat: false,
    };
  }

  // No detection possible
  return {
    format: 'unknown',
    mimeType: mimeType ?? 'application/octet-stream',
    extension: '',
    confidence: 'low',
    isManuscriptFormat: false,
  };
}

/**
 * Detects format from file path using magic bytes.
 *
 * @param filePath - Path to the file
 * @param mimeType - Optional MIME type header
 * @returns Detected format with confidence level
 *
 * @example
 * ```typescript
 * const detected = await detectFormatFromFile('/path/to/paper.docx');
 * console.log(detected.format); // 'docx'
 * ```
 *
 * @public
 */
export async function detectFormatFromFile(
  filePath: string,
  mimeType?: string
): Promise<DetectedFormat> {
  const filename = basename(filePath);

  // Strategy 1: Magic bytes detection (highest confidence)
  const fileType = await fileTypeFromFile(filePath);
  if (fileType) {
    const format = MIME_TO_FORMAT.get(fileType.mime);
    if (format) {
      return {
        format,
        mimeType: fileType.mime,
        extension: fileType.ext,
        confidence: 'high',
        category: inferCategoryFromExtension(fileType.ext, filename),
        isManuscriptFormat: MANUSCRIPT_FORMATS.has(format),
      };
    }

    // Known file type but not a manuscript format
    return {
      format: fileType.ext,
      mimeType: fileType.mime,
      extension: fileType.ext,
      confidence: 'high',
      category: inferCategoryFromExtension(fileType.ext, filename),
      isManuscriptFormat: false,
    };
  }

  // Strategy 2: MIME type header (medium confidence)
  if (mimeType) {
    const format = MIME_TO_FORMAT.get(mimeType);
    const ext = normalizeExtension(extname(filename));
    if (format) {
      return {
        format,
        mimeType,
        extension: ext,
        confidence: 'medium',
        category: inferCategoryFromExtension(ext, filename),
        isManuscriptFormat: MANUSCRIPT_FORMATS.has(format),
      };
    }
  }

  // Strategy 3: File extension (lowest confidence)
  const ext = normalizeExtension(extname(filename));
  const format = EXTENSION_TO_FORMAT.get(ext);
  if (format) {
    const inferredMime = getMimeTypeForFormat(format);
    return {
      format,
      mimeType: mimeType ?? inferredMime,
      extension: ext,
      confidence: 'low',
      category: inferCategoryFromExtension(ext, filename),
      isManuscriptFormat: MANUSCRIPT_FORMATS.has(format),
    };
  }

  // Unknown format
  return {
    format: ext || 'unknown',
    mimeType: mimeType ?? 'application/octet-stream',
    extension: ext || '',
    confidence: 'low',
    category: inferCategoryFromExtension(ext, filename),
    isManuscriptFormat: false,
  };
}

/**
 * Infers supplementary category from extension and filename patterns.
 *
 * @param extension - File extension (without dot)
 * @param filename - Original filename
 * @returns Inferred category or undefined
 */
function inferCategoryFromExtension(
  extension: string,
  filename?: string
): SupplementaryCategory | undefined {
  // Check direct extension mapping
  const categoryFromExt = EXTENSION_TO_CATEGORY.get(extension.toLowerCase());
  if (categoryFromExt) {
    return categoryFromExt;
  }

  // Check filename patterns
  if (filename) {
    const lowerName = filename.toLowerCase();

    // Appendix patterns
    if (
      lowerName.includes('appendix') ||
      lowerName.includes('supplementary_text') ||
      lowerName.includes('supporting_information')
    ) {
      return 'appendix';
    }

    // Figure patterns
    if (
      /figure[_\-\s]?s?\d+/i.exec(lowerName) ||
      /fig[_\-\s]?s?\d+/i.exec(lowerName) ||
      lowerName.includes('extended_data_fig')
    ) {
      return 'figure';
    }

    // Table patterns
    if (/table[_\-\s]?s?\d+/i.exec(lowerName) || lowerName.includes('supplementary_table')) {
      return 'table';
    }

    // Protocol patterns
    if (lowerName.includes('protocol') || lowerName.includes('methods')) {
      return 'protocol';
    }

    // Questionnaire patterns
    if (lowerName.includes('questionnaire') || lowerName.includes('survey')) {
      return 'questionnaire';
    }
  }

  return undefined;
}

/**
 * Normalizes file extension (removes dot, lowercases).
 */
function normalizeExtension(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase();
}

/**
 * Gets the primary MIME type for a document format.
 */
function getMimeTypeForFormat(format: DocumentFormat): string {
  const formatToMime: Record<DocumentFormat, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    html: 'text/html',
    markdown: 'text/markdown',
    latex: 'text/x-tex',
    jupyter: 'application/x-ipynb+json',
    odt: 'application/vnd.oasis.opendocument.text',
    rtf: 'application/rtf',
    epub: 'application/epub+zip',
    txt: 'text/plain',
  };
  return formatToMime[format];
}

/**
 * Checks if a format is a valid manuscript format.
 *
 * @param format - Format to check
 * @returns True if format is valid for primary manuscripts
 *
 * @public
 */
export function isManuscriptFormat(format: string): format is DocumentFormat {
  return MANUSCRIPT_FORMATS.has(format as DocumentFormat);
}

/**
 * Gets all supported manuscript MIME types.
 *
 * @returns Array of accepted MIME types for manuscript upload
 *
 * @public
 */
export function getSupportedManuscriptMimeTypes(): readonly string[] {
  return Array.from(MIME_TO_FORMAT.keys());
}

/**
 * Gets all supported manuscript extensions.
 *
 * @returns Array of accepted extensions for manuscript upload
 *
 * @public
 */
export function getSupportedManuscriptExtensions(): readonly string[] {
  return Array.from(EXTENSION_TO_FORMAT.keys());
}
