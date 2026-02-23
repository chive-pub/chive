/**
 * Extracts citation text from non-PDF document formats.
 *
 * @remarks
 * Handles text extraction from all supported Chive document formats
 * except PDF (which uses GROBID's processReferences endpoint directly).
 * Extracts individual citation strings from reference sections that can
 * then be parsed by GROBID's processCitation endpoint.
 *
 * Supported formats: docx, html, markdown, latex, jupyter, odt, rtf, epub, txt.
 *
 * @packageDocumentation
 * @public
 */

import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as cheerio from 'cheerio';

import { addSpanAttributes, withSpan } from '../../observability/tracer.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Minimum character length for a string to be considered a valid citation.
 */
const MIN_CITATION_LENGTH = 20;

/**
 * Minimum character length for a line to be considered a citation
 * in single-line splitting mode.
 */
const MIN_LINE_LENGTH = 30;

/**
 * Minimum number of entries required for a splitting strategy to be accepted.
 */
const MIN_SPLIT_ENTRIES = 2;

/**
 * Headings that typically introduce a reference/bibliography section.
 */
const REFERENCE_HEADING_TERMS = [
  'references',
  'bibliography',
  'works cited',
  'cited works',
  'literature',
  'literature cited',
] as const;

/**
 * Extracts raw citation strings from non-PDF documents.
 *
 * @remarks
 * Parses document content to locate reference/bibliography sections and
 * extracts individual citation strings. These strings are then sent to
 * GROBID's processCitation endpoint for structured parsing.
 *
 * PDF documents are not handled here; they are sent directly to GROBID's
 * processReferences endpoint by the citation extraction service.
 *
 * @example
 * ```typescript
 * const extractor = new DocumentTextExtractor({ logger });
 *
 * // Extract citations from a LaTeX document
 * const citations = await extractor.extractReferencesText(latexBuffer, 'latex');
 * console.log(`Found ${citations.length} citations`);
 *
 * // Extract citations from a DOCX file
 * const docxCitations = await extractor.extractReferencesText(docxBuffer, 'docx');
 * ```
 *
 * @public
 */
export class DocumentTextExtractor {
  private readonly logger: ILogger;

  /**
   * Creates a new DocumentTextExtractor.
   *
   * @param options - Extractor configuration
   */
  constructor(options: { readonly logger: ILogger }) {
    this.logger = options.logger.child({ service: 'document-text-extractor' });
  }

  /**
   * Extracts individual citation strings from a document's reference section.
   *
   * @param buffer - Document content as a Buffer
   * @param format - Document format (e.g., 'latex', 'docx', 'html')
   * @returns Array of raw citation strings, one per reference
   *
   * @remarks
   * Dispatches to format-specific extraction methods. Returns an empty array
   * for PDF (handled by GROBID directly) and for unsupported formats.
   */
  async extractReferencesText(buffer: Buffer, format: string): Promise<string[]> {
    return withSpan('documentTextExtractor.extract', async () => {
      addSpanAttributes({ 'document.format': format, 'document.size_bytes': buffer.length });

      this.logger.debug('Extracting references text from document', {
        format,
        sizeBytes: buffer.length,
      });

      try {
        const citations = await this.dispatchByFormat(buffer, format);

        this.logger.info('Citation extraction completed', {
          format,
          citationCount: citations.length,
          sizeBytes: buffer.length,
        });

        return citations;
      } catch (error) {
        this.logger.warn('Citation extraction failed', {
          format,
          error: error instanceof Error ? error.message : String(error),
          sizeBytes: buffer.length,
        });
        return [];
      }
    });
  }

  /**
   * Dispatches extraction to the appropriate format handler.
   *
   * @param buffer - Document content
   * @param format - Document format identifier
   * @returns Extracted citation strings
   */
  private async dispatchByFormat(buffer: Buffer, format: string): Promise<string[]> {
    switch (format) {
      case 'pdf':
        return [];
      case 'docx':
      case 'odt':
      case 'rtf':
        return this.extractFromOfficeDocument(buffer, format);
      case 'html':
        return this.extractFromHtml(buffer);
      case 'latex':
        return this.extractFromLatex(buffer);
      case 'epub':
        return this.extractFromEpub(buffer);
      case 'markdown':
        return this.extractFromMarkdown(buffer);
      case 'jupyter':
        return this.extractFromJupyter(buffer);
      case 'txt':
        return this.extractFromPlainText(buffer.toString('utf-8'));
      default:
        this.logger.warn('Unsupported document format for citation extraction', { format });
        return [];
    }
  }

  /**
   * Extracts citations from DOCX, ODT, or RTF documents using officeparser.
   *
   * @param buffer - Document content as a Buffer
   * @param format - The office format ('docx', 'odt', or 'rtf')
   * @returns Extracted citation strings
   *
   * @remarks
   * Uses officeparser to convert the document to plain text via its AST,
   * then applies plain-text reference section detection and splitting.
   */
  private async extractFromOfficeDocument(buffer: Buffer, format: string): Promise<string[]> {
    this.logger.debug('Extracting citations from office document', { format });

    const { parseOffice } = await import('officeparser');
    const ast = await parseOffice(buffer);
    const text = ast.toText();

    return this.extractFromPlainText(text);
  }

  /**
   * Extracts citations from an HTML document.
   *
   * @param buffer - HTML content as a Buffer
   * @returns Extracted citation strings
   *
   * @remarks
   * Parses the HTML with cheerio, locates headings containing reference-related
   * terms (e.g., "References", "Bibliography"), and extracts text from subsequent
   * list items, paragraphs, or divs.
   */
  private extractFromHtml(buffer: Buffer): string[] {
    this.logger.debug('Extracting citations from HTML');

    const $ = cheerio.load(buffer.toString('utf-8'));

    // Find a heading that matches reference section terms
    const headingSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    let refSection: ReturnType<typeof $> | null = null;

    for (const selector of headingSelectors) {
      $(selector).each((_index, element) => {
        if (refSection) return;
        const headingText = $(element).text().trim().toLowerCase();
        const isReferenceHeading = REFERENCE_HEADING_TERMS.some(
          (term) => headingText === term || headingText.endsWith(term)
        );
        if (isReferenceHeading) {
          refSection = $(element);
        }
      });
      if (refSection) break;
    }

    if (!refSection) {
      this.logger.debug('No reference section heading found in HTML');
      return [];
    }

    // Collect all sibling elements after the reference heading until the next heading
    const citations: string[] = [];
    let current = (refSection as ReturnType<typeof $>).next();

    while (current.length > 0) {
      const tagName = current.prop('tagName')?.toLowerCase();

      // Stop at the next heading
      if (tagName && /^h[1-6]$/.test(tagName)) {
        break;
      }

      // Extract text from list items within <ol> or <ul>
      if (tagName === 'ol' || tagName === 'ul') {
        current.find('li').each((_index, li) => {
          const text = $(li).text().trim();
          if (text.length >= MIN_CITATION_LENGTH) {
            citations.push(text);
          }
        });
      } else if (tagName === 'p' || tagName === 'div') {
        const text = current.text().trim();
        if (text.length >= MIN_CITATION_LENGTH) {
          citations.push(text);
        }
      }

      current = current.next();
    }

    return citations;
  }

  /**
   * Extracts citations from a LaTeX document.
   *
   * @param buffer - LaTeX content as a Buffer
   * @returns Extracted citation strings
   *
   * @remarks
   * Supports two extraction paths:
   * 1. BibTeX entries (`@article{...}`, `@book{...}`, etc.) parsed via citation-js
   * 2. `\bibitem` entries extracted via regex
   *
   * Falls back to plain-text extraction if neither pattern is found.
   */
  private async extractFromLatex(buffer: Buffer): Promise<string[]> {
    this.logger.debug('Extracting citations from LaTeX');

    const text = buffer.toString('utf-8');

    // Path 1: Look for BibTeX entries
    const bibtexMatch = text.match(/@\w+\{[\s\S]+?\n\}/g);
    if (bibtexMatch && bibtexMatch.length > 0) {
      const bibtexCitations = await this.parseBibtexEntries(bibtexMatch.join('\n'));
      if (bibtexCitations.length > 0) {
        return bibtexCitations;
      }
    }

    // Path 2: Look for \bibitem entries
    const bibitemCitations = this.parseBibitemEntries(text);
    if (bibitemCitations.length > 0) {
      return bibitemCitations;
    }

    // Fallback: try plain-text extraction
    return this.extractFromPlainText(text);
  }

  /**
   * Parses BibTeX entries into formatted citation strings using citation-js.
   *
   * @param bibtexText - Concatenated BibTeX entries
   * @returns Formatted citation strings
   */
  private async parseBibtexEntries(bibtexText: string): Promise<string[]> {
    try {
      // Load the BibTeX plugin (side-effect: registers parser with citation-js core),
      // then import citation-js itself to create a Cite instance.
      await import('@citation-js/plugin-bibtex');
      const { default: Cite } = await import('citation-js');

      const cite = new Cite(bibtexText);
      const data = cite.data;

      return data
        .map((entry) => {
          const authors =
            entry.author?.map((a) => `${a.given ?? ''} ${a.family ?? ''}`.trim()).join(', ') ?? '';
          const title = entry.title ?? '';
          const dateParts = entry.issued?.['date-parts'];
          const firstDatePart = dateParts?.[0]?.[0];
          const year = firstDatePart != null ? String(firstDatePart) : '';
          return `${authors}. ${title}. ${year}`.trim();
        })
        .filter((s) => s.length > MIN_CITATION_LENGTH);
    } catch (error) {
      this.logger.warn('Failed to parse BibTeX entries with citation-js', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Extracts citation text from `\bibitem` entries in LaTeX source.
   *
   * @param text - Full LaTeX document text
   * @returns Extracted citation strings
   */
  private parseBibitemEntries(text: string): string[] {
    const bibitemRegex =
      /\\bibitem(?:\[.*?\])?\{.*?\}([\s\S]*?)(?=\\bibitem|\\end\{thebibliography\}|$)/g;

    const citations: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = bibitemRegex.exec(text)) !== null) {
      const citationText = match[1];
      if (!citationText) continue;

      const cleaned = citationText
        .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1') // strip simple LaTeX commands
        .replace(/[{}\\]/g, '') // remove remaining braces and backslashes
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned.length >= MIN_CITATION_LENGTH) {
        citations.push(cleaned);
      }
    }

    return citations;
  }

  /**
   * Extracts citations from an EPUB file.
   *
   * @param buffer - EPUB content as a Buffer
   * @returns Extracted citation strings
   *
   * @remarks
   * epub2 requires a file path, so the buffer is written to a temporary file,
   * parsed, and the temp file is cleaned up afterward. Each chapter is retrieved
   * as HTML and searched for reference sections using the HTML extraction logic.
   */
  private async extractFromEpub(buffer: Buffer): Promise<string[]> {
    this.logger.debug('Extracting citations from EPUB');

    const tempPath = join(
      tmpdir(),
      `chive-epub-${Date.now()}-${Math.random().toString(36).slice(2)}.epub`
    );
    await writeFile(tempPath, buffer);

    try {
      const { EPub } = await import('epub2');
      const epub = (await EPub.createAsync(tempPath)) as InstanceType<typeof EPub>;

      // Iterate through the spine (ordered reading content) to find references
      const flow: readonly { readonly id?: string }[] = epub.flow ?? [];
      const allCitations: string[] = [];

      for (const chapter of flow) {
        if (!chapter.id) continue;

        try {
          const html = String(await epub.getChapterAsync(chapter.id));
          const chapterCitations = this.extractFromHtml(Buffer.from(html, 'utf-8'));
          allCitations.push(...chapterCitations);
        } catch {
          // Some chapters may fail to parse; skip them
          this.logger.debug('Failed to read EPUB chapter', { chapterId: chapter.id });
        }
      }

      // If no structured references found, try concatenating all text and
      // doing plain-text extraction
      if (allCitations.length === 0) {
        const allText: string[] = [];
        for (const chapter of flow) {
          if (!chapter.id) continue;
          try {
            const html = String(await epub.getChapterAsync(chapter.id));
            const $ = cheerio.load(html);
            allText.push($.text());
          } catch {
            // skip unreadable chapters
          }
        }
        return this.extractFromPlainText(allText.join('\n'));
      }

      return allCitations;
    } finally {
      await unlink(tempPath).catch(() => undefined);
    }
  }

  /**
   * Extracts citations from a Markdown document.
   *
   * @param buffer - Markdown content as a Buffer
   * @returns Extracted citation strings
   *
   * @remarks
   * Locates a reference section by searching for headings like `## References`
   * or `# Bibliography`, then extracts list items or paragraphs below.
   */
  private extractFromMarkdown(buffer: Buffer): string[] {
    this.logger.debug('Extracting citations from Markdown');

    const text = buffer.toString('utf-8');
    return this.extractFromPlainText(text);
  }

  /**
   * Extracts citations from a Jupyter notebook.
   *
   * @param buffer - Jupyter notebook JSON content as a Buffer
   * @returns Extracted citation strings
   *
   * @remarks
   * Parses the notebook JSON, concatenates all markdown cell sources,
   * then applies plain-text reference section detection.
   */
  private extractFromJupyter(buffer: Buffer): string[] {
    this.logger.debug('Extracting citations from Jupyter notebook');

    try {
      const notebook = JSON.parse(buffer.toString('utf-8')) as JupyterNotebook;
      const cells = notebook.cells ?? [];

      const markdownText = cells
        .filter((cell) => cell.cell_type === 'markdown')
        .map((cell) => {
          if (Array.isArray(cell.source)) {
            return cell.source.join('');
          }
          return typeof cell.source === 'string' ? cell.source : '';
        })
        .join('\n\n');

      return this.extractFromPlainText(markdownText);
    } catch (error) {
      this.logger.warn('Failed to parse Jupyter notebook JSON', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Extracts citations from plain text by locating the reference section
   * and splitting it into individual citation strings.
   *
   * @param text - Plain text document content
   * @returns Extracted citation strings
   */
  private extractFromPlainText(text: string): string[] {
    const refStart = this.findReferenceSectionStart(text);
    if (refStart === -1) return [];

    const refText = text.slice(refStart);
    return this.splitCitationStrings(refText);
  }

  /**
   * Finds the byte offset where the reference section begins.
   *
   * @param text - Document text
   * @returns Character index of the start of the reference section content,
   *   or -1 if no reference section heading is found
   *
   * @remarks
   * Searches for headings like "References", "Bibliography", "Works Cited",
   * and "Literature". Supports markdown-style headings (prefixed with `#`),
   * numbered headings, and plain headings on their own line.
   */
  private findReferenceSectionStart(text: string): number {
    const termPattern = REFERENCE_HEADING_TERMS.join('|');
    const patterns = [
      // Markdown-style headings: ## References
      new RegExp(`\\n\\s*#{1,4}\\s*(?:${termPattern})\\s*\\n`, 'i'),
      // Numbered headings: 7. References  or  7 References
      new RegExp(`\\n\\s*(?:\\d+\\.?\\s+)?(?:${termPattern})\\s*\\n`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        return match.index + match[0].length;
      }
    }

    return -1;
  }

  /**
   * Splits reference section text into individual citation strings.
   *
   * @param text - Text from the reference section
   * @returns Individual citation strings
   *
   * @remarks
   * Tries three strategies in order:
   * 1. Numbered references: `[1]`, `[2]` or `1.`, `2.`
   * 2. Blank-line-separated paragraphs
   * 3. One citation per line (for lines exceeding {@link MIN_LINE_LENGTH} characters)
   */
  private splitCitationStrings(text: string): string[] {
    // Strategy 1: Numbered references [1], [2] or 1., 2.
    const numbered = text
      .split(/\n\s*\[?\d+\]?\.?\s+/)
      .filter((s) => s.trim().length > MIN_CITATION_LENGTH);
    if (numbered.length > MIN_SPLIT_ENTRIES) {
      return numbered.map((s) => s.replace(/\s+/g, ' ').trim());
    }

    // Strategy 2: Blank-line-separated paragraphs
    const paragraphs = text.split(/\n\s*\n/).filter((s) => s.trim().length > MIN_CITATION_LENGTH);
    if (paragraphs.length > MIN_SPLIT_ENTRIES) {
      return paragraphs.map((s) => s.replace(/\s+/g, ' ').trim());
    }

    // Strategy 3: One citation per line (long lines)
    const lines = text.split('\n').filter((s) => s.trim().length > MIN_LINE_LENGTH);
    return lines.map((s) => s.trim());
  }
}

/**
 * Minimal Jupyter notebook JSON structure.
 */
interface JupyterNotebook {
  readonly cells?: readonly JupyterCell[];
}

/**
 * A single cell in a Jupyter notebook.
 */
interface JupyterCell {
  readonly cell_type: string;
  readonly source: string | readonly string[];
}
