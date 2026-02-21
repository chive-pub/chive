/**
 * GROBID client for PDF reference extraction.
 *
 * @remarks
 * Communicates with the GROBID REST API to extract structured
 * bibliographic references from PDF documents. GROBID returns
 * TEI-XML, which is parsed into structured {@link GrobidReference}
 * objects.
 *
 * Uses a circuit breaker to prevent cascading failures when GROBID
 * is unavailable or overloaded.
 *
 * ATProto Compliance:
 * - PDF buffers are fetched from user PDSes via {@link IRepository.getBlob}
 * - Buffers are streamed to GROBID and never persisted by Chive
 * - Extracted references are derived data (rebuildable)
 *
 * @packageDocumentation
 * @public
 */

import type { IPolicy } from 'cockatiel';

import type { GrobidConfig } from '../../config/grobid.js';
import { withSpan } from '../../observability/tracer.js';
import { ServiceUnavailableError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { createResiliencePolicy } from '../common/resilience.js';

/**
 * Reference extracted from a PDF by GROBID.
 *
 * @public
 */
export interface GrobidReference {
  /**
   * Raw citation text as it appears in the PDF.
   */
  readonly rawText: string;

  /**
   * Parsed title of the referenced work.
   */
  readonly title?: string;

  /**
   * Parsed authors of the referenced work.
   */
  readonly authors?: readonly { readonly firstName?: string; readonly lastName: string }[];

  /**
   * DOI of the referenced work (if detected).
   */
  readonly doi?: string;

  /**
   * Publication year.
   */
  readonly year?: number;

  /**
   * Journal or venue name.
   */
  readonly journal?: string;

  /**
   * Volume number.
   */
  readonly volume?: string;

  /**
   * Page range.
   */
  readonly pages?: string;
}

/**
 * Interface for the GROBID client.
 *
 * @public
 */
export interface IGrobidClient {
  /**
   * Extracts bibliographic references from a PDF.
   *
   * @param pdfBuffer - PDF document as a Buffer
   * @returns Array of extracted references
   * @throws {ServiceUnavailableError} when GROBID is unreachable
   */
  extractReferences(pdfBuffer: Buffer): Promise<GrobidReference[]>;

  /**
   * Parses raw citation strings into structured references via GROBID.
   *
   * @param citations - Array of raw citation strings (e.g., extracted from non-PDF documents)
   * @returns Successfully parsed references (failures are skipped with warnings)
   * @throws {ServiceUnavailableError} when GROBID is unreachable
   */
  parseCitationStrings(citations: string[]): Promise<GrobidReference[]>;

  /**
   * Checks whether the GROBID service is available.
   *
   * @returns true if GROBID responds to health checks
   */
  isAvailable(): Promise<boolean>;
}

/**
 * GROBID REST API client with circuit breaker.
 *
 * @remarks
 * Sends PDFs to GROBID's `/api/processReferences` endpoint and
 * parses the TEI-XML response into structured reference objects.
 *
 * The circuit breaker opens after 5 consecutive failures, preventing
 * wasted requests when GROBID is down. It half-opens after 30 seconds
 * to allow a probe request.
 *
 * @example
 * ```typescript
 * const client = new GrobidClient({ config: getGrobidConfig(), logger });
 *
 * if (await client.isAvailable()) {
 *   const refs = await client.extractReferences(pdfBuffer);
 *   console.log(`Extracted ${refs.length} references`);
 * }
 * ```
 *
 * @public
 */
export class GrobidClient implements IGrobidClient {
  private readonly logger: ILogger;
  private readonly config: GrobidConfig;
  private readonly resiliencePolicy: IPolicy;

  /**
   * Creates a new GrobidClient.
   *
   * @param options - Client configuration
   */
  constructor(options: { readonly config: GrobidConfig; readonly logger: ILogger }) {
    this.config = options.config;
    this.logger = options.logger.child({ service: 'grobid-client' });

    this.resiliencePolicy = createResiliencePolicy({
      circuitBreaker: {
        name: 'grobid',
        failureThreshold: 5,
        timeout: 30000,
        logger: this.logger,
      },
      retry: {
        name: 'grobid',
        maxAttempts: 2,
        baseDelay: 1000,
        maxDelay: 5000,
        logger: this.logger,
      },
    });
  }

  /**
   * Extracts bibliographic references from a PDF.
   *
   * @param pdfBuffer - PDF document as a Buffer
   * @returns Array of extracted references
   * @throws {ServiceUnavailableError} when GROBID is unreachable or circuit is open
   *
   * @remarks
   * Posts the PDF to GROBID's `/api/processReferences` endpoint with
   * `consolidateCitations=1` for DOI resolution. Parses the TEI-XML
   * response using regex-based extraction (no external XML parser needed
   * for this flat structure).
   */
  async extractReferences(pdfBuffer: Buffer): Promise<GrobidReference[]> {
    if (!this.config.enabled) {
      this.logger.debug('GROBID is disabled, skipping reference extraction');
      return [];
    }

    return withSpan(
      'grobid.extractReferences',
      async () => {
        const startTime = Date.now();

        try {
          const teiXml = await this.resiliencePolicy.execute(async () => {
            return this.postPdf(pdfBuffer);
          });

          const references = this.parseTeiXml(teiXml);
          const durationMs = Date.now() - startTime;

          this.logger.info('GROBID reference extraction completed', {
            referenceCount: references.length,
            durationMs,
            pdfSizeBytes: pdfBuffer.length,
          });

          return references;
        } catch (error) {
          const durationMs = Date.now() - startTime;
          this.logger.warn('GROBID reference extraction failed', {
            error: error instanceof Error ? error.message : String(error),
            durationMs,
            pdfSizeBytes: pdfBuffer.length,
          });

          throw new ServiceUnavailableError(
            'GROBID reference extraction failed',
            'grobid',
            error instanceof Error ? error : undefined
          );
        }
      },
      {
        attributes: {
          'grobid.pdf_size_bytes': pdfBuffer.length,
          'grobid.endpoint': `${this.config.url}/api/processReferences`,
        },
      }
    );
  }

  /**
   * Checks whether the GROBID service is available.
   *
   * @returns true if GROBID responds to its health endpoint
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.url}/api/isalive`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Parses raw citation strings into structured references via GROBID.
   *
   * @param citations - Array of raw citation strings
   * @returns Successfully parsed references (individual failures are skipped)
   *
   * @remarks
   * Sends each citation string to GROBID's `/api/processCitation` endpoint
   * with `Content-Type: application/x-www-form-urlencoded`. Requests are
   * batched with a concurrency limit of 5 to avoid overwhelming GROBID.
   *
   * Individual failures are logged as warnings and skipped; the method
   * returns all successfully parsed references.
   */
  async parseCitationStrings(citations: string[]): Promise<GrobidReference[]> {
    if (!this.config.enabled) {
      this.logger.debug('GROBID is disabled, skipping citation string parsing');
      return [];
    }

    if (citations.length === 0) {
      return [];
    }

    return withSpan(
      'grobid.parseCitationStrings',
      async () => {
        const startTime = Date.now();
        const references: GrobidReference[] = [];
        let successCount = 0;
        let failureCount = 0;

        // Process in batches with concurrency limit of 5
        const CONCURRENCY = 5;
        for (let i = 0; i < citations.length; i += CONCURRENCY) {
          const batch = citations.slice(i, i + CONCURRENCY);
          const results = await Promise.allSettled(
            batch.map(async (citation) => {
              const teiXml = await this.postCitationString(citation);
              return this.parseTeiXml(teiXml);
            })
          );

          for (let j = 0; j < results.length; j++) {
            const result = results[j];
            if (result?.status === 'fulfilled') {
              references.push(...result.value);
              successCount++;
            } else if (result?.status === 'rejected') {
              failureCount++;
              this.logger.warn('Failed to parse citation string via GROBID', {
                citationIndex: i + j,
                error:
                  result.reason instanceof Error ? result.reason.message : String(result.reason),
              });
            }
          }
        }

        const durationMs = Date.now() - startTime;

        this.logger.info('GROBID citation string parsing completed', {
          totalCitations: citations.length,
          successCount,
          failureCount,
          referencesExtracted: references.length,
          durationMs,
        });

        return references;
      },
      {
        attributes: {
          'grobid.citation_count': citations.length,
          'grobid.endpoint': `${this.config.url}/api/processCitation`,
        },
      }
    );
  }

  /**
   * Posts a PDF to GROBID's processReferences endpoint.
   *
   * @param pdfBuffer - PDF content
   * @returns TEI-XML response body
   */
  private async postPdf(pdfBuffer: Buffer): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('input', blob, 'document.pdf');
    formData.append('consolidateCitations', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.url}/api/processReferences`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new ServiceUnavailableError(
          `GROBID returned HTTP ${response.status}: ${body.slice(0, 200)}`,
          'grobid'
        );
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ServiceUnavailableError) {
        throw error;
      }

      throw new ServiceUnavailableError(
        `GROBID request failed: ${error instanceof Error ? error.message : String(error)}`,
        'grobid',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Posts a single citation string to GROBID's processCitation endpoint.
   *
   * @param citation - Raw citation string
   * @returns TEI-XML response body
   */
  private async postCitationString(citation: string): Promise<string> {
    const body = new URLSearchParams({ citations: citation });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.url}/api/processCitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '');
        throw new ServiceUnavailableError(
          `GROBID processCitation returned HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
          'grobid'
        );
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ServiceUnavailableError) {
        throw error;
      }

      throw new ServiceUnavailableError(
        `GROBID processCitation request failed: ${error instanceof Error ? error.message : String(error)}`,
        'grobid',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parses GROBID TEI-XML response into structured references.
   *
   * @param teiXml - TEI-XML string from GROBID
   * @returns Parsed references
   *
   * @remarks
   * Uses regex-based extraction to parse the `<biblStruct>` elements
   * from GROBID's TEI-XML output. This avoids adding a heavy XML parser
   * dependency for what is a relatively flat, predictable XML structure.
   *
   * The project already has `cheerio` and `htmlparser2` available, but
   * the GROBID TEI-XML is simple enough for regex extraction.
   */
  private parseTeiXml(teiXml: string): GrobidReference[] {
    const references: GrobidReference[] = [];

    // Extract each <biblStruct> element
    const biblStructPattern = /<biblStruct[\s\S]*?<\/biblStruct>/g;
    let match: RegExpExecArray | null;

    while ((match = biblStructPattern.exec(teiXml)) !== null) {
      const biblStruct = match[0];
      const ref = this.parseBiblStruct(biblStruct);
      if (ref) {
        references.push(ref);
      }
    }

    return references;
  }

  /**
   * Parses a single `<biblStruct>` element into a GrobidReference.
   *
   * @param xml - A single biblStruct XML fragment
   * @returns Parsed reference, or null if insufficient data
   */
  private parseBiblStruct(xml: string): GrobidReference | null {
    // Extract raw citation text from <note type="raw_reference">
    const rawText = this.extractTagContent(xml, 'note', 'raw_reference') ?? '';

    // Extract title from <title> inside <analytic>
    const analyticBlock = this.extractBlock(xml, 'analytic');
    const title = analyticBlock
      ? this.extractSimpleTag(analyticBlock, 'title')
      : this.extractSimpleTag(xml, 'title');

    // Extract authors
    const authors = this.extractAuthors(xml);

    // Extract DOI from <idno type="DOI">
    const doi = this.extractTagContent(xml, 'idno', 'DOI');

    // Extract year from <date>
    const year = this.extractYear(xml);

    // Extract journal from <title> inside <monogr>
    const monogrBlock = this.extractBlock(xml, 'monogr');
    const journal = monogrBlock ? this.extractSimpleTag(monogrBlock, 'title') : undefined;

    // Extract volume
    const volume = this.extractTagContent(xml, 'biblScope', 'volume');

    // Extract pages
    const pages = this.extractPages(xml);

    // Require at least a title or raw text
    if (!title && !rawText) {
      return null;
    }

    return {
      rawText,
      title: title ?? undefined,
      authors: authors.length > 0 ? authors : undefined,
      doi: doi ?? undefined,
      year: year ?? undefined,
      journal: journal ?? undefined,
      volume: volume ?? undefined,
      pages: pages ?? undefined,
    };
  }

  /**
   * Extracts content from a tag with a specific type attribute.
   *
   * @param xml - XML fragment
   * @param tag - Tag name
   * @param type - Type attribute value
   * @returns Tag text content, or null
   */
  private extractTagContent(xml: string, tag: string, type: string): string | null {
    const pattern = new RegExp(`<${tag}[^>]*type=["']${type}["'][^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const match = pattern.exec(xml);
    if (!match?.[1]) return null;
    return this.stripTags(match[1]).trim() || null;
  }

  /**
   * Extracts content from a simple tag (no type attribute filtering).
   *
   * @param xml - XML fragment
   * @param tag - Tag name
   * @returns Tag text content, or undefined
   */
  private extractSimpleTag(xml: string, tag: string): string | undefined {
    const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const match = pattern.exec(xml);
    if (!match?.[1]) return undefined;
    const content = this.stripTags(match[1]).trim();
    return content || undefined;
  }

  /**
   * Extracts a block element (e.g., `<analytic>...</analytic>`).
   *
   * @param xml - XML fragment
   * @param tag - Block tag name
   * @returns Block content, or null
   */
  private extractBlock(xml: string, tag: string): string | null {
    const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const match = pattern.exec(xml);
    return match?.[1] ?? null;
  }

  /**
   * Extracts authors from `<author>` elements within a biblStruct.
   *
   * @param xml - biblStruct XML fragment
   * @returns Array of author objects
   */
  private extractAuthors(
    xml: string
  ): { readonly firstName?: string; readonly lastName: string }[] {
    const authors: { readonly firstName?: string; readonly lastName: string }[] = [];
    const authorPattern = /<author[\s\S]*?<\/author>/gi;
    let authorMatch: RegExpExecArray | null;

    while ((authorMatch = authorPattern.exec(xml)) !== null) {
      const authorXml = authorMatch[0];

      // Extract surname (required)
      const surnameMatch = /<surname[^>]*>([\s\S]*?)<\/surname>/i.exec(authorXml);
      if (!surnameMatch?.[1]) continue;

      const lastName = this.stripTags(surnameMatch[1]).trim();
      if (!lastName) continue;

      // Extract forename (optional)
      const forenameMatch = /<forename[^>]*>([\s\S]*?)<\/forename>/i.exec(authorXml);
      const firstName = forenameMatch?.[1] ? this.stripTags(forenameMatch[1]).trim() : undefined;

      authors.push({
        firstName: firstName ?? undefined,
        lastName,
      });
    }

    return authors;
  }

  /**
   * Extracts the publication year from `<date>` elements.
   *
   * @param xml - XML fragment
   * @returns Year as number, or undefined
   */
  private extractYear(xml: string): number | undefined {
    // Try when attribute first
    const whenMatch = /<date[^>]*when=["'](\d{4})/i.exec(xml);
    if (whenMatch?.[1]) {
      return parseInt(whenMatch[1], 10);
    }

    // Try date content
    const dateMatch = /<date[^>]*>([\s\S]*?)<\/date>/i.exec(xml);
    if (dateMatch?.[1]) {
      const yearMatch = /\b(19|20)\d{2}\b/.exec(dateMatch[1]);
      if (yearMatch) {
        return parseInt(yearMatch[0], 10);
      }
    }

    return undefined;
  }

  /**
   * Extracts page range from biblScope elements.
   *
   * @param xml - XML fragment
   * @returns Page range string, or undefined
   */
  private extractPages(xml: string): string | undefined {
    const unitPageMatch =
      /<biblScope[^>]*unit=["']page["'][^>]*(?:from=["'](\d+)["'][^>]*to=["'](\d+)["'])?[^>]*>([\s\S]*?)<\/biblScope>/i.exec(
        xml
      );

    if (unitPageMatch) {
      if (unitPageMatch[1] && unitPageMatch[2]) {
        return `${unitPageMatch[1]}-${unitPageMatch[2]}`;
      }
      const content = this.stripTags(unitPageMatch[3] ?? '').trim();
      return content || undefined;
    }

    return undefined;
  }

  /**
   * Strips XML/HTML tags from a string.
   *
   * @param text - Text with potential tags
   * @returns Plain text
   */
  private stripTags(text: string): string {
    // Decode HTML entities first (GROBID sometimes entity-encodes HTML tags)
    const decoded = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"');
    return decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  }
}
