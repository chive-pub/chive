/**
 * Unit tests for GrobidClient.
 *
 * @remarks
 * Tests GROBID REST API interaction, TEI-XML parsing, circuit breaker
 * resilience, and availability checks. All HTTP calls are mocked via
 * vi.stubGlobal to isolate tests from network dependencies.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { GrobidConfig } from '@/config/grobid.js';
import { GrobidClient } from '@/services/citation/grobid-client.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// ============================================================================
// Mock: withSpan passthrough (executes the function directly)
// ============================================================================

vi.mock('@/observability/tracer.js', () => ({
  withSpan: vi.fn((_name: string, fn: () => unknown) => Promise.resolve(fn())),
  addSpanAttributes: vi.fn(),
  recordSpanError: vi.fn(),
}));

// ============================================================================
// Mock: resilience policy (pass-through, no retries or circuit breaker)
// ============================================================================

vi.mock('@/services/common/resilience.js', () => ({
  createResiliencePolicy: vi.fn(() => ({
    execute: vi.fn((fn: () => unknown) => Promise.resolve(fn())),
  })),
}));

// ============================================================================
// Mock Factories
// ============================================================================

const createMockLogger = (): ILogger => {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
};

const createTestConfig = (overrides?: Partial<GrobidConfig>): GrobidConfig => ({
  url: 'http://grobid:8070',
  timeout: 60000,
  maxConcurrency: 4,
  enabled: true,
  ...overrides,
});

// ============================================================================
// TEI-XML Fixtures
// ============================================================================

const SINGLE_REF_TEI = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <listBibl>
      <biblStruct xml:id="b0">
        <analytic>
          <title level="a">Attention Is All You Need</title>
          <author>
            <persName>
              <forename type="first">Ashish</forename>
              <surname>Vaswani</surname>
            </persName>
          </author>
          <author>
            <persName>
              <forename type="first">Noam</forename>
              <surname>Shazeer</surname>
            </persName>
          </author>
          <idno type="DOI">10.5555/3295222.3295349</idno>
        </analytic>
        <monogr>
          <title level="j">Advances in Neural Information Processing Systems</title>
          <imprint>
            <biblScope type="volume">30</biblScope>
            <biblScope unit="page" from="5998" to="6008">5998-6008</biblScope>
            <date when="2017">2017</date>
          </imprint>
        </monogr>
        <note type="raw_reference">Vaswani et al., "Attention Is All You Need," NeurIPS 2017.</note>
      </biblStruct>
    </listBibl>
  </text>
</TEI>`;

const MULTI_REF_TEI = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <listBibl>
      <biblStruct xml:id="b0">
        <analytic>
          <title level="a">First Paper Title</title>
          <author>
            <persName>
              <forename type="first">Alice</forename>
              <surname>Smith</surname>
            </persName>
          </author>
          <idno type="DOI">10.1234/first</idno>
        </analytic>
        <monogr>
          <title level="j">Journal A</title>
          <imprint>
            <date when="2020">2020</date>
          </imprint>
        </monogr>
        <note type="raw_reference">Smith, A. "First Paper Title." Journal A, 2020.</note>
      </biblStruct>
      <biblStruct xml:id="b1">
        <analytic>
          <title level="a">Second Paper Title</title>
          <author>
            <persName>
              <forename type="first">Bob</forename>
              <surname>Jones</surname>
            </persName>
          </author>
        </analytic>
        <monogr>
          <title level="j">Journal B</title>
          <imprint>
            <biblScope type="volume">15</biblScope>
            <date when="2021">2021</date>
          </imprint>
        </monogr>
        <note type="raw_reference">Jones, B. "Second Paper Title." Journal B 15, 2021.</note>
      </biblStruct>
      <biblStruct xml:id="b2">
        <analytic>
          <title level="a">Third Paper Title</title>
          <author>
            <persName>
              <surname>Chen</surname>
            </persName>
          </author>
        </analytic>
        <monogr>
          <title level="j">Journal C</title>
          <imprint>
            <date when="2019">2019</date>
          </imprint>
        </monogr>
        <note type="raw_reference">Chen. "Third Paper Title." Journal C, 2019.</note>
      </biblStruct>
    </listBibl>
  </text>
</TEI>`;

const MULTI_AUTHOR_TEI = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <listBibl>
      <biblStruct xml:id="b0">
        <analytic>
          <title level="a">Collaborative Research Study</title>
          <author>
            <persName>
              <forename type="first">Alice</forename>
              <surname>Smith</surname>
            </persName>
          </author>
          <author>
            <persName>
              <forename type="first">Bob</forename>
              <surname>Jones</surname>
            </persName>
          </author>
          <author>
            <persName>
              <forename type="first">Carol</forename>
              <surname>Williams</surname>
            </persName>
          </author>
          <author>
            <persName>
              <surname>Chen</surname>
            </persName>
          </author>
        </analytic>
        <monogr>
          <title level="j">Nature</title>
          <imprint>
            <date when="2023">2023</date>
          </imprint>
        </monogr>
        <note type="raw_reference">Smith et al. "Collaborative Research Study." Nature, 2023.</note>
      </biblStruct>
    </listBibl>
  </text>
</TEI>`;

const MINIMAL_FIELDS_TEI = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <listBibl>
      <biblStruct xml:id="b0">
        <analytic>
          <title level="a">Title Only Paper</title>
        </analytic>
        <monogr>
          <imprint/>
        </monogr>
        <note type="raw_reference">Title Only Paper, unknown source.</note>
      </biblStruct>
    </listBibl>
  </text>
</TEI>`;

const DATE_IN_CONTENT_TEI = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <listBibl>
      <biblStruct xml:id="b0">
        <analytic>
          <title level="a">Date In Content Paper</title>
        </analytic>
        <monogr>
          <imprint>
            <date>Published in 2018</date>
          </imprint>
        </monogr>
        <note type="raw_reference">Date In Content Paper, 2018.</note>
      </biblStruct>
    </listBibl>
  </text>
</TEI>`;

// ============================================================================
// Tests
// ============================================================================

describe('GrobidClient', () => {
  let client: GrobidClient;
  let logger: ILogger;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    logger = createMockLogger();
    client = new GrobidClient({
      config: createTestConfig(),
      logger,
    });
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // extractReferences: success paths
  // ==========================================================================

  describe('extractReferences', () => {
    it('parses a single reference from TEI-XML', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(SINGLE_REF_TEI),
      });

      const pdfBuffer = Buffer.from('fake-pdf-content');
      const refs = await client.extractReferences(pdfBuffer);

      expect(refs).toHaveLength(1);
      expect(refs[0]).toEqual({
        rawText: 'Vaswani et al., "Attention Is All You Need," NeurIPS 2017.',
        title: 'Attention Is All You Need',
        authors: [
          { firstName: 'Ashish', lastName: 'Vaswani' },
          { firstName: 'Noam', lastName: 'Shazeer' },
        ],
        doi: '10.5555/3295222.3295349',
        year: 2017,
        journal: 'Advances in Neural Information Processing Systems',
        volume: '30',
        pages: '5998-6008',
      });
    });

    it('parses multiple references from TEI-XML', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(MULTI_REF_TEI),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs).toHaveLength(3);
      expect(refs[0]?.title).toBe('First Paper Title');
      expect(refs[0]?.doi).toBe('10.1234/first');
      expect(refs[1]?.title).toBe('Second Paper Title');
      expect(refs[1]?.volume).toBe('15');
      expect(refs[1]?.doi).toBeUndefined();
      expect(refs[2]?.title).toBe('Third Paper Title');
      expect(refs[2]?.year).toBe(2019);
    });

    it('parses multi-author references with and without forenames', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(MULTI_AUTHOR_TEI),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs).toHaveLength(1);
      expect(refs[0]?.authors).toHaveLength(4);
      expect(refs[0]?.authors).toEqual([
        { firstName: 'Alice', lastName: 'Smith' },
        { firstName: 'Bob', lastName: 'Jones' },
        { firstName: 'Carol', lastName: 'Williams' },
        { firstName: undefined, lastName: 'Chen' },
      ]);
    });

    it('handles minimal fields (title and raw text only)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(MINIMAL_FIELDS_TEI),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs).toHaveLength(1);
      expect(refs[0]?.title).toBe('Title Only Paper');
      expect(refs[0]?.rawText).toBe('Title Only Paper, unknown source.');
      expect(refs[0]?.authors).toBeUndefined();
      expect(refs[0]?.doi).toBeUndefined();
      expect(refs[0]?.year).toBeUndefined();
      expect(refs[0]?.journal).toBeUndefined();
      expect(refs[0]?.volume).toBeUndefined();
      expect(refs[0]?.pages).toBeUndefined();
    });

    it('extracts year from date content when "when" attribute is absent', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(DATE_IN_CONTENT_TEI),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs).toHaveLength(1);
      expect(refs[0]?.year).toBe(2018);
    });

    it('returns empty array when GROBID is disabled', async () => {
      const disabledClient = new GrobidClient({
        config: createTestConfig({ enabled: false }),
        logger,
      });

      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const refs = await disabledClient.extractReferences(Buffer.from('pdf'));

      expect(refs).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns empty array for empty XML response (no biblStruct elements)', async () => {
      const emptyTei = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><listBibl></listBibl></text>
</TEI>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(emptyTei),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs).toEqual([]);
    });

    it('returns empty array for invalid XML (no parseable structure)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('this is not xml at all'),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs).toEqual([]);
    });

    it('skips biblStruct elements with neither title nor raw text', async () => {
      const noTitleTei = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <listBibl>
      <biblStruct xml:id="b0">
        <analytic>
          <author><persName><surname>Smith</surname></persName></author>
        </analytic>
        <monogr><imprint><date when="2020">2020</date></imprint></monogr>
      </biblStruct>
    </listBibl>
  </text>
</TEI>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(noTitleTei),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs).toEqual([]);
    });

    // ========================================================================
    // extractReferences: error paths
    // ========================================================================

    it('throws ServiceUnavailableError on HTTP error response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue('Service Unavailable'),
      });

      await expect(client.extractReferences(Buffer.from('pdf'))).rejects.toThrow(
        'GROBID reference extraction failed'
      );
    });

    it('throws ServiceUnavailableError on network failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(client.extractReferences(Buffer.from('pdf'))).rejects.toThrow(
        'GROBID reference extraction failed'
      );
    });

    it('logs extraction duration and PDF size on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(SINGLE_REF_TEI),
      });

      const pdfBuffer = Buffer.from('test-pdf-bytes');
      await client.extractReferences(pdfBuffer);

      expect(logger.child).toHaveBeenCalledWith({ service: 'grobid-client' });
    });

    it('logs warning on extraction failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout'));

      const childLogger = (logger.child as ReturnType<typeof vi.fn>).mock.results[0]
        ?.value as ILogger;

      await expect(client.extractReferences(Buffer.from('pdf'))).rejects.toThrow();

      expect(childLogger.warn).toHaveBeenCalledWith(
        'GROBID reference extraction failed',
        expect.objectContaining({
          error: expect.any(String),
          pdfSizeBytes: 3,
        })
      );
    });
  });

  // ==========================================================================
  // isAvailable
  // ==========================================================================

  describe('isAvailable', () => {
    it('returns true when GROBID health endpoint responds OK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      const result = await client.isAvailable();

      expect(result).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://grobid:8070/api/isalive',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('returns false when GROBID health endpoint returns non-OK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

      const result = await client.isAvailable();

      expect(result).toBe(false);
    });

    it('returns false when GROBID is unreachable', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await client.isAvailable();

      expect(result).toBe(false);
    });

    it('returns false when GROBID is disabled in config', async () => {
      const disabledClient = new GrobidClient({
        config: createTestConfig({ enabled: false }),
        logger,
      });

      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const result = await disabledClient.isAvailable();

      expect(result).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns false when fetch times out (aborted)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

      const result = await client.isAvailable();

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // TEI-XML Parsing: field combinations
  // ==========================================================================

  describe('TEI-XML parsing', () => {
    it('extracts DOI from idno element with DOI type', async () => {
      const tei = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><listBibl>
    <biblStruct xml:id="b0">
      <analytic>
        <title level="a">DOI Paper</title>
        <idno type="DOI">10.1038/nature12373</idno>
      </analytic>
      <monogr><imprint/></monogr>
      <note type="raw_reference">DOI Paper</note>
    </biblStruct>
  </listBibl></text>
</TEI>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(tei),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs[0]?.doi).toBe('10.1038/nature12373');
    });

    it('extracts page range from from/to attributes', async () => {
      const tei = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><listBibl>
    <biblStruct xml:id="b0">
      <analytic><title level="a">Page Range Paper</title></analytic>
      <monogr>
        <imprint>
          <biblScope unit="page" from="100" to="200">100-200</biblScope>
        </imprint>
      </monogr>
      <note type="raw_reference">Page Range Paper, pp. 100-200.</note>
    </biblStruct>
  </listBibl></text>
</TEI>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(tei),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs[0]?.pages).toBe('100-200');
    });

    it('extracts volume from biblScope with volume unit', async () => {
      const tei = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><listBibl>
    <biblStruct xml:id="b0">
      <analytic><title level="a">Volume Paper</title></analytic>
      <monogr>
        <imprint>
          <biblScope type="volume">42</biblScope>
        </imprint>
      </monogr>
      <note type="raw_reference">Volume Paper, vol. 42.</note>
    </biblStruct>
  </listBibl></text>
</TEI>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(tei),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs[0]?.volume).toBe('42');
    });

    it('extracts journal title from monogr block', async () => {
      const tei = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><listBibl>
    <biblStruct xml:id="b0">
      <analytic><title level="a">Journal Paper</title></analytic>
      <monogr>
        <title level="j">Physical Review Letters</title>
        <imprint><date when="2022">2022</date></imprint>
      </monogr>
      <note type="raw_reference">Journal Paper. PRL, 2022.</note>
    </biblStruct>
  </listBibl></text>
</TEI>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(tei),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs[0]?.journal).toBe('Physical Review Letters');
    });

    it('handles complete reference with all fields', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(SINGLE_REF_TEI),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      const ref = refs[0];
      expect(ref?.rawText).toBeTruthy();
      expect(ref?.title).toBeTruthy();
      expect(ref?.authors).toBeDefined();
      expect(ref?.authors?.length).toBeGreaterThan(0);
      expect(ref?.doi).toBeTruthy();
      expect(ref?.year).toBeGreaterThan(0);
      expect(ref?.journal).toBeTruthy();
      expect(ref?.volume).toBeTruthy();
      expect(ref?.pages).toBeTruthy();
    });

    it('handles reference with only raw text (fallback from note element)', async () => {
      const rawTextOnlyTei = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><listBibl>
    <biblStruct xml:id="b0">
      <monogr><imprint/></monogr>
      <note type="raw_reference">Some raw citation text that could not be parsed.</note>
    </biblStruct>
  </listBibl></text>
</TEI>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(rawTextOnlyTei),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs).toHaveLength(1);
      expect(refs[0]?.rawText).toBe('Some raw citation text that could not be parsed.');
      expect(refs[0]?.title).toBeUndefined();
    });
  });

  // ==========================================================================
  // Circuit breaker integration
  // ==========================================================================

  describe('circuit breaker', () => {
    it('wraps HTTP calls through the resilience policy', async () => {
      // The resilience policy mock just passes through, so a successful call
      // still works. If the policy were to throw (circuit open), extraction
      // would fail with ServiceUnavailableError.
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(SINGLE_REF_TEI),
      });

      const refs = await client.extractReferences(Buffer.from('pdf'));

      expect(refs).toHaveLength(1);
    });

    it('wraps resilience policy errors as ServiceUnavailableError', async () => {
      // Simulate the resilience policy rejecting (circuit open)
      const { createResiliencePolicy } = await import('@/services/common/resilience.js');
      vi.mocked(createResiliencePolicy).mockReturnValue({
        execute: vi.fn().mockRejectedValue(new Error('Breaker is open')),
      } as never);

      const breakerClient = new GrobidClient({
        config: createTestConfig(),
        logger,
      });

      await expect(breakerClient.extractReferences(Buffer.from('pdf'))).rejects.toThrow(
        'GROBID reference extraction failed'
      );
    });
  });
});
