/**
 * Document text extraction service for multiple formats.
 *
 * @remarks
 * Extracts clean text and document structure from various formats including
 * PDF, DOCX, HTML, Markdown, LaTeX, Jupyter notebooks, and more.
 *
 * Uses format-specific extractors:
 * - PDF/DOCX/ODT/RTF: officeParser with rich AST
 * - HTML: cheerio with semantic structure preservation
 * - Markdown: markdown-it AST parsing
 * - Jupyter: cell-by-cell extraction
 *
 * @packageDocumentation
 * @public
 * @since 0.2.0
 */

import * as cheerio from 'cheerio';
import MarkdownIt from 'markdown-it';
import { OfficeParser } from 'officeparser';

import { detectFormat, type DetectedFormat } from './format-detector.js';

/**
 * Heading extracted from document structure.
 *
 * @public
 */
export interface Heading {
  /**
   * Heading level (1-6).
   */
  readonly level: number;

  /**
   * Heading text content.
   */
  readonly text: string;

  /**
   * Character offset in extracted text.
   */
  readonly offset: number;
}

/**
 * Paragraph extracted from document.
 *
 * @public
 */
export interface Paragraph {
  /**
   * Paragraph text content.
   */
  readonly text: string;

  /**
   * Character offset in extracted text.
   */
  readonly offset: number;
}

/**
 * Code block extracted from document.
 *
 * @public
 */
export interface CodeBlock {
  /**
   * Code content.
   */
  readonly code: string;

  /**
   * Programming language (if detected).
   */
  readonly language?: string;

  /**
   * Character offset in extracted text.
   */
  readonly offset: number;
}

/**
 * Table extracted from document.
 *
 * @public
 */
export interface Table {
  /**
   * Table headers.
   */
  readonly headers: readonly string[];

  /**
   * Table rows (array of cells).
   */
  readonly rows: readonly (readonly string[])[];

  /**
   * Character offset in extracted text.
   */
  readonly offset: number;
}

/**
 * Page boundary information.
 *
 * @public
 */
export interface PageBoundary {
  /**
   * Page number (1-indexed).
   */
  readonly pageNumber: number;

  /**
   * Character offset where page starts.
   */
  readonly startOffset: number;

  /**
   * Character offset where page ends.
   */
  readonly endOffset: number;
}

/**
 * Document structure parsed from content.
 *
 * @public
 */
export interface DocumentStructure {
  /**
   * Headings with hierarchical levels.
   */
  readonly headings: readonly Heading[];

  /**
   * Paragraphs of body text.
   */
  readonly paragraphs: readonly Paragraph[];

  /**
   * Code blocks with language hints.
   */
  readonly codeBlocks: readonly CodeBlock[];

  /**
   * Tables with headers and rows.
   */
  readonly tables: readonly Table[];

  /**
   * Page boundaries (for paginated formats like PDF).
   */
  readonly pages?: readonly PageBoundary[];
}

/**
 * Metadata extracted from document.
 *
 * @public
 */
export interface DocumentMetadata {
  /**
   * Detected document format (may be any file extension for non-manuscript files).
   */
  readonly format: string;

  /**
   * Document title (if found in metadata).
   */
  readonly title?: string;

  /**
   * Document author (if found in metadata).
   */
  readonly author?: string;

  /**
   * Document creation date.
   */
  readonly creationDate?: Date;

  /**
   * Document last modification date.
   */
  readonly modificationDate?: Date;

  /**
   * Page count (for paginated formats).
   */
  readonly pageCount?: number;

  /**
   * Total word count.
   */
  readonly wordCount: number;

  /**
   * Total character count.
   */
  readonly characterCount: number;

  /**
   * Detected language (ISO 639-1 code).
   */
  readonly language?: string;
}

/**
 * Result of document extraction.
 *
 * @public
 */
export interface ExtractedDocument {
  /**
   * Raw extracted text (includes formatting artifacts).
   */
  readonly text: string;

  /**
   * Clean text optimized for indexing (no formatting).
   */
  readonly cleanText: string;

  /**
   * Parsed document structure.
   */
  readonly structure: DocumentStructure;

  /**
   * Document metadata.
   */
  readonly metadata: DocumentMetadata;

  /**
   * Format detection result.
   */
  readonly detectedFormat: DetectedFormat;
}

/**
 * Extraction options.
 *
 * @public
 */
export interface ExtractionOptions {
  /**
   * Whether to preserve whitespace formatting.
   *
   * @defaultValue false
   */
  readonly preserveWhitespace?: boolean;

  /**
   * Whether to extract document structure (headings, tables, etc.).
   *
   * @defaultValue true
   */
  readonly extractStructure?: boolean;

  /**
   * Maximum text length to extract (characters).
   *
   * @defaultValue Infinity
   */
  readonly maxLength?: number;

  /**
   * Filename hint for format detection.
   */
  readonly filename?: string;

  /**
   * MIME type hint for format detection.
   */
  readonly mimeType?: string;
}

const markdownParser = new MarkdownIt();

/**
 * Extracts text and structure from a document buffer.
 *
 * @param buffer - Document content as Uint8Array
 * @param options - Extraction options
 * @returns Extracted document with text, structure, and metadata
 *
 * @example
 * ```typescript
 * const buffer = await readFile('paper.pdf');
 * const doc = await extractDocument(buffer, { filename: 'paper.pdf' });
 * console.log(doc.cleanText);
 * console.log(doc.metadata.wordCount);
 * ```
 *
 * @public
 */
export async function extractDocument(
  buffer: Uint8Array,
  options: ExtractionOptions = {}
): Promise<ExtractedDocument> {
  const { extractStructure = true, filename, mimeType } = options;

  // Detect format
  const detectedFormat = await detectFormat(buffer, filename, mimeType);
  const format = detectedFormat.format;

  // Route to format-specific extractor
  let text: string;
  let structure: DocumentStructure = {
    headings: [],
    paragraphs: [],
    codeBlocks: [],
    tables: [],
  };

  switch (format) {
    case 'pdf':
      ({ text, structure } = await extractPdf(buffer, extractStructure));
      break;

    case 'docx':
    case 'odt':
    case 'rtf':
      ({ text, structure } = await extractOffice(buffer, extractStructure));
      break;

    case 'html':
      ({ text, structure } = extractHtml(buffer, extractStructure));
      break;

    case 'markdown':
      ({ text, structure } = extractMarkdown(buffer, extractStructure));
      break;

    case 'jupyter':
      ({ text, structure } = extractJupyter(buffer, extractStructure));
      break;

    case 'latex':
      ({ text, structure } = extractLatex(buffer, extractStructure));
      break;

    case 'txt':
    case 'epub':
    default:
      text = new TextDecoder('utf-8').decode(buffer);
      break;
  }

  // Apply max length if specified
  const maxLength = options.maxLength ?? Infinity;
  const truncatedText = text.length > maxLength ? text.slice(0, maxLength) : text;

  // Generate clean text (strip extra whitespace)
  const cleanText = generateCleanText(truncatedText, options.preserveWhitespace);

  // Compute metadata
  const metadata = computeMetadata(cleanText, detectedFormat, structure);

  return {
    text: truncatedText,
    cleanText,
    structure,
    metadata,
    detectedFormat,
  };
}

/**
 * Extracts text from PDF using officeParser.
 */
async function extractPdf(
  buffer: Uint8Array,
  extractStructure: boolean
): Promise<{ text: string; structure: DocumentStructure }> {
  const ast = await OfficeParser.parseOffice(Buffer.from(buffer));
  const text = ast.toText();

  const headings: Heading[] = [];
  const paragraphs: Paragraph[] = [];

  if (extractStructure) {
    const lines = text.split('\n');
    let offset = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        if (trimmed.length < 100 && trimmed === trimmed.toUpperCase()) {
          headings.push({
            level: 1,
            text: trimmed,
            offset,
          });
        } else {
          paragraphs.push({
            text: trimmed,
            offset,
          });
        }
      }
      offset += line.length + 1;
    }
  }

  return {
    text,
    structure: {
      headings,
      paragraphs,
      codeBlocks: [],
      tables: [],
    },
  };
}

/**
 * Extracts text from Office formats using officeParser.
 */
async function extractOffice(
  buffer: Uint8Array,
  extractStructure: boolean
): Promise<{ text: string; structure: DocumentStructure }> {
  const ast = await OfficeParser.parseOffice(Buffer.from(buffer));
  const text = ast.toText();

  const headings: Heading[] = [];
  const paragraphs: Paragraph[] = [];

  if (extractStructure) {
    const lines = text.split('\n');
    let offset = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        if (trimmed.length < 100 && trimmed === trimmed.toUpperCase()) {
          headings.push({
            level: 1,
            text: trimmed,
            offset,
          });
        } else {
          paragraphs.push({
            text: trimmed,
            offset,
          });
        }
      }
      offset += line.length + 1;
    }
  }

  return {
    text,
    structure: {
      headings,
      paragraphs,
      codeBlocks: [],
      tables: [],
    },
  };
}

/**
 * Extracts text from HTML using cheerio.
 */
function extractHtml(
  buffer: Uint8Array,
  extractStructure: boolean
): { text: string; structure: DocumentStructure } {
  const html = new TextDecoder('utf-8').decode(buffer);
  const $ = cheerio.load(html);

  // Remove script and style elements
  $('script, style, noscript').remove();

  const headings: Heading[] = [];
  const paragraphs: Paragraph[] = [];
  const codeBlocks: CodeBlock[] = [];
  const tables: Table[] = [];
  let offset = 0;

  if (extractStructure) {
    // Extract headings
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tagName = 'tagName' in el ? el.tagName : '';
      const levelChar = tagName[1] ?? '1';
      const level = parseInt(levelChar, 10) || 1;
      const text = $(el).text().trim();
      if (text) {
        headings.push({ level, text, offset });
        offset += text.length + 1;
      }
    });

    // Extract paragraphs
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        paragraphs.push({ text, offset });
        offset += text.length + 1;
      }
    });

    // Extract code blocks
    $('pre, code').each((_, el) => {
      const code = $(el).text().trim();
      const lang = $(el)
        .attr('class')
        ?.match(/language-(\w+)/)?.[1];
      if (code) {
        codeBlocks.push({ code, language: lang, offset });
        offset += code.length + 1;
      }
    });

    // Extract tables
    $('table').each((_, tableEl) => {
      const headers: string[] = [];
      const rows: string[][] = [];

      $(tableEl)
        .find('th')
        .each((_, th) => {
          headers.push($(th).text().trim());
        });

      $(tableEl)
        .find('tr')
        .each((_, tr) => {
          const row: string[] = [];
          $(tr)
            .find('td')
            .each((_, td) => {
              row.push($(td).text().trim());
            });
          if (row.length > 0) {
            rows.push(row);
          }
        });

      if (headers.length > 0 || rows.length > 0) {
        tables.push({ headers, rows, offset });
      }
    });
  }

  const text = $.text();

  return {
    text,
    structure: {
      headings,
      paragraphs,
      codeBlocks,
      tables,
    },
  };
}

/**
 * Extracts text from Markdown using markdown-it.
 */
function extractMarkdown(
  buffer: Uint8Array,
  extractStructure: boolean
): { text: string; structure: DocumentStructure } {
  const markdown = new TextDecoder('utf-8').decode(buffer);
  const tokens = markdownParser.parse(markdown, {});

  const headings: Heading[] = [];
  const paragraphs: Paragraph[] = [];
  const codeBlocks: CodeBlock[] = [];
  let offset = 0;

  if (extractStructure) {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;

      if (token.type === 'heading_open') {
        const tag = token.tag ?? '';
        const levelChar = tag[1] ?? '1';
        const level = parseInt(levelChar, 10) || 1;
        const content = tokens[i + 1];
        if (content?.type === 'inline' && content.content) {
          headings.push({
            level,
            text: content.content,
            offset,
          });
          offset += content.content.length + 1;
        }
      } else if (token.type === 'paragraph_open') {
        const content = tokens[i + 1];
        if (content?.type === 'inline' && content.content) {
          paragraphs.push({
            text: content.content,
            offset,
          });
          offset += content.content.length + 1;
        }
      } else if (token.type === 'fence' || token.type === 'code_block') {
        const code = token.content ?? '';
        codeBlocks.push({
          code,
          language: token.info || undefined,
          offset,
        });
        offset += code.length + 1;
      }
    }
  }

  // Render to plain text
  const html = markdownParser.render(markdown);
  const $ = cheerio.load(html);
  const text = $.text();

  return {
    text,
    structure: {
      headings,
      paragraphs,
      codeBlocks,
      tables: [],
    },
  };
}

/**
 * Extracts text from Jupyter notebooks.
 */
function extractJupyter(
  buffer: Uint8Array,
  extractStructure: boolean
): { text: string; structure: DocumentStructure } {
  const json = new TextDecoder('utf-8').decode(buffer);

  interface JupyterCell {
    cell_type: 'code' | 'markdown' | 'raw';
    source: string | string[];
    outputs?: {
      text?: string | string[];
      data?: {
        'text/plain'?: string | string[];
      };
    }[];
  }

  interface JupyterNotebook {
    cells: JupyterCell[];
  }

  let notebook: JupyterNotebook;
  try {
    notebook = JSON.parse(json) as JupyterNotebook;
  } catch {
    return {
      text: json,
      structure: {
        headings: [],
        paragraphs: [],
        codeBlocks: [],
        tables: [],
      },
    };
  }

  const textParts: string[] = [];
  const headings: Heading[] = [];
  const paragraphs: Paragraph[] = [];
  const codeBlocks: CodeBlock[] = [];
  let offset = 0;

  for (const cell of notebook.cells || []) {
    const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;

    if (cell.cell_type === 'markdown') {
      textParts.push(source);

      if (extractStructure) {
        // Parse markdown content
        const lines = source.split('\n');
        for (const line of lines) {
          const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
          if (headingMatch?.[1] && headingMatch[2]) {
            headings.push({
              level: headingMatch[1].length,
              text: headingMatch[2].trim(),
              offset,
            });
          } else if (line.trim()) {
            paragraphs.push({
              text: line.trim(),
              offset,
            });
          }
          offset += line.length + 1;
        }
      }
    } else if (cell.cell_type === 'code') {
      textParts.push(source);

      if (extractStructure) {
        codeBlocks.push({
          code: source,
          language: 'python', // Default for Jupyter
          offset,
        });
      }
      offset += source.length + 1;

      // Include outputs
      if (cell.outputs) {
        for (const output of cell.outputs) {
          const outputText = output.text ?? output.data?.['text/plain'];
          if (outputText) {
            const text = Array.isArray(outputText) ? outputText.join('') : outputText;
            textParts.push(`Output: ${text}`);
            offset += text.length + 10;
          }
        }
      }
    }
  }

  return {
    text: textParts.join('\n\n'),
    structure: {
      headings,
      paragraphs,
      codeBlocks,
      tables: [],
    },
  };
}

/**
 * Extracts text from LaTeX (basic extraction).
 */
function extractLatex(
  buffer: Uint8Array,
  extractStructure: boolean
): { text: string; structure: DocumentStructure } {
  const latex = new TextDecoder('utf-8').decode(buffer);

  const headings: Heading[] = [];
  const paragraphs: Paragraph[] = [];
  let offset = 0;

  if (extractStructure) {
    // Extract sections
    const sectionPattern = /\\(section|subsection|subsubsection|chapter)\{([^}]+)\}/g;
    let match;
    while ((match = sectionPattern.exec(latex)) !== null) {
      const sectionType = match[1];
      const sectionText = match[2];
      if (!sectionText) continue;

      const level =
        sectionType === 'chapter'
          ? 1
          : sectionType === 'section'
            ? 2
            : sectionType === 'subsection'
              ? 3
              : 4;
      headings.push({
        level,
        text: sectionText,
        offset: match.index,
      });
    }
  }

  // Strip LaTeX commands for clean text
  const text = latex
    // Remove comments
    .replace(/%.*$/gm, '')
    // Remove begin/end environments
    .replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}/g, '')
    // Remove commands with arguments
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, (match) => {
      // Keep content of some commands
      const content = /\{([^}]*)\}/.exec(match)?.[1];
      return content ?? '';
    })
    // Remove simple commands
    .replace(/\\[a-zA-Z]+/g, '')
    // Clean up braces
    .replace(/[{}]/g, '')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Extract paragraphs from cleaned text
  if (extractStructure) {
    const paras = text.split(/\n\n+/);
    for (const para of paras) {
      const trimmed = para.trim();
      if (trimmed.length > 20) {
        paragraphs.push({
          text: trimmed,
          offset,
        });
      }
      offset += para.length + 2;
    }
  }

  return {
    text,
    structure: {
      headings,
      paragraphs,
      codeBlocks: [],
      tables: [],
    },
  };
}

/**
 * Generates clean text optimized for indexing.
 */
function generateCleanText(text: string, preserveWhitespace?: boolean): string {
  if (preserveWhitespace) {
    return text;
  }

  return (
    text
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      // Collapse multiple spaces
      .replace(/[ \t]+/g, ' ')
      // Collapse multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      // Trim lines
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim()
  );
}

/**
 * Computes document metadata from extracted content.
 */
function computeMetadata(
  text: string,
  detectedFormat: DetectedFormat,
  structure: DocumentStructure
): DocumentMetadata {
  // Word count (split on whitespace)
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  // Character count (excluding whitespace)
  const characterCount = text.replace(/\s/g, '').length;

  // Page count (from structure if available)
  const pageCount = structure.pages?.length;

  return {
    format: detectedFormat.format,
    wordCount,
    characterCount,
    pageCount,
  };
}

/**
 * Extracts document metadata only (without full text extraction).
 *
 * @param buffer - Document content as Uint8Array
 * @param options - Extraction options
 * @returns Document metadata
 *
 * @public
 */
export async function extractMetadataOnly(
  buffer: Uint8Array,
  options: ExtractionOptions = {}
): Promise<DocumentMetadata> {
  const doc = await extractDocument(buffer, {
    ...options,
    extractStructure: false,
    maxLength: 50000, // Limit for metadata extraction
  });

  return doc.metadata;
}
