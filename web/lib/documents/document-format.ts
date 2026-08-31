/**
 * Maps an uploaded document's MIME type to the format the viewers dispatch on.
 *
 * @remarks
 * The submission wizard accepts thirteen MIME types across ten formats, and the
 * eprint page rendered every one of them through the PDF viewer — so a
 * Markdown, LaTeX, HTML, Jupyter or plain-text manuscript was handed to pdf.js,
 * which rejected it as a malformed PDF. `DocumentViewer` could already render
 * five of those formats and was mounted nowhere.
 *
 * The MIME strings here mirror `MIME_TO_FORMAT` in
 * `src/services/content-extraction/format-detector.ts`, which is what the
 * backend records at submission time. Extensions are a fallback for records
 * whose blob carries a generic `application/octet-stream`.
 *
 * @packageDocumentation
 */

import type { DocumentFormat } from '@/lib/api/generated/types/pub/chive/defs';

const MIME_TO_FORMAT: ReadonlyMap<string, DocumentFormat> = new Map([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['text/html', 'html'],
  ['text/markdown', 'markdown'],
  ['text/x-markdown', 'markdown'],
  ['text/x-tex', 'latex'],
  ['application/x-tex', 'latex'],
  ['application/x-latex', 'latex'],
  ['application/x-ipynb+json', 'jupyter'],
  ['application/vnd.oasis.opendocument.text', 'odt'],
  ['application/rtf', 'rtf'],
  ['text/rtf', 'rtf'],
  ['application/epub+zip', 'epub'],
  ['text/plain', 'txt'],
]);

const EXTENSION_TO_FORMAT: ReadonlyMap<string, DocumentFormat> = new Map([
  ['pdf', 'pdf'],
  ['docx', 'docx'],
  ['doc', 'docx'],
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
]);

const TEXT_FORMATS: ReadonlySet<DocumentFormat> = new Set<DocumentFormat>([
  'html',
  'markdown',
  'latex',
  'jupyter',
  'txt',
]);

/**
 * Determines a document's format from its MIME type, falling back to filename.
 *
 * @param mimeType - MIME type recorded on the blob
 * @param filename - Optional filename, used when the MIME type is generic
 * @returns The format, defaulting to `pdf`
 *
 * @remarks
 * Defaulting to `pdf` keeps the behaviour every existing eprint relies on:
 * essentially all of them are PDFs, and many were indexed before the format was
 * recorded at all.
 *
 * @public
 */
export function detectDocumentFormat(mimeType?: string, filename?: string): DocumentFormat {
  const normalized = mimeType?.split(';')[0]?.trim().toLowerCase();
  const byMime = normalized ? MIME_TO_FORMAT.get(normalized) : undefined;
  if (byMime) {
    return byMime;
  }

  const extension = filename?.split('.').pop()?.toLowerCase();
  return (extension ? EXTENSION_TO_FORMAT.get(extension) : undefined) ?? 'pdf';
}

/**
 * Whether a format is rendered by the PDF viewer.
 *
 * @param format - Document format
 * @returns True for PDF
 *
 * @public
 */
export function isPdfFormat(format: DocumentFormat): boolean {
  return format === 'pdf';
}

/**
 * Whether a format is rendered by `DocumentViewer` from text content.
 *
 * @param format - Document format
 * @returns True when the document can be fetched as text and rendered
 *
 * @public
 */
export function isTextFormat(format: DocumentFormat): boolean {
  return TEXT_FORMATS.has(format);
}

/**
 * Human-readable name for a format, for use in the UI.
 *
 * @param format - Document format
 * @returns A display name
 *
 * @public
 */
export function formatDisplayName(format: DocumentFormat): string {
  switch (format) {
    case 'pdf':
      return 'PDF';
    case 'docx':
      return 'Word document';
    case 'html':
      return 'HTML';
    case 'markdown':
      return 'Markdown';
    case 'latex':
      return 'LaTeX';
    case 'jupyter':
      return 'Jupyter notebook';
    case 'odt':
      return 'OpenDocument text';
    case 'rtf':
      return 'Rich Text Format';
    case 'epub':
      return 'EPUB';
    case 'txt':
      return 'Plain text';
    default:
      return format.toUpperCase();
  }
}

/**
 * Canonical file extension for a format.
 *
 * @param format - Document format
 * @returns The extension, without a leading dot
 *
 * @remarks
 * The eprint page offered every manuscript as `<title>.pdf`, so downloading a
 * Markdown or LaTeX submission produced a file the operating system opened with
 * the wrong application.
 *
 * @public
 */
export function formatExtension(format: DocumentFormat): string {
  switch (format) {
    case 'markdown':
      return 'md';
    case 'latex':
      return 'tex';
    case 'jupyter':
      return 'ipynb';
    case 'pdf':
    case 'docx':
    case 'html':
    case 'odt':
    case 'rtf':
    case 'epub':
    case 'txt':
      return format;
    default:
      return 'bin';
  }
}
