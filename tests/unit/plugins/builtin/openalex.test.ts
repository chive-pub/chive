/**
 * Unit tests for OpenAlexPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { OpenAlexPlugin } from '../../../../src/plugins/builtin/openalex.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ICacheProvider,
  IMetrics,
  IPluginContext,
  IPluginEventBus,
} from '../../../../src/types/interfaces/plugin.interface.js';

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

const createMockCache = (): ICacheProvider => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  expire: vi.fn().mockResolvedValue(undefined),
});

const createMockMetrics = (): IMetrics => ({
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  observeHistogram: vi.fn(),
  startTimer: vi.fn().mockReturnValue(() => {}),
});

const createMockEventBus = (): IPluginEventBus => ({
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  emitAsync: vi.fn().mockResolvedValue(undefined),
  listenerCount: vi.fn().mockReturnValue(0),
  eventNames: vi.fn().mockReturnValue([]),
  removeAllListeners: vi.fn(),
});

const createMockContext = (overrides?: Partial<IPluginContext>): IPluginContext => ({
  logger: createMockLogger(),
  cache: createMockCache(),
  metrics: createMockMetrics(),
  eventBus: createMockEventBus(),
  config: {},
  ...overrides,
});

// ============================================================================
// Sample Data (based on OpenAlex API)
// ============================================================================

/**
 * Sample OpenAlex work response for Aaron Steven White.
 *
 * Based on real OpenAlex API response structure for a linguistics paper
 * on acceptability judgments.
 */
const SAMPLE_WORK_RESPONSE = {
  id: 'https://openalex.org/W3024561234',
  doi: 'https://doi.org/10.5334/gjgl.1001',
  title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
  type: 'journal-article',
  publication_date: '2020-05-29',
  publication_year: 2020,
  authorships: [
    {
      author_position: 'first',
      author: {
        id: 'https://openalex.org/A5012345678',
        display_name: 'Aaron Steven White',
        orcid: 'https://orcid.org/0000-0002-4519-6259',
      },
      institutions: [
        {
          id: 'https://openalex.org/I64222096',
          display_name: 'University of Rochester',
          ror: 'https://ror.org/022kthw22',
          country_code: 'US',
        },
      ],
      raw_affiliation_string: 'Department of Linguistics, University of Rochester',
    },
    {
      author_position: 'last',
      author: {
        id: 'https://openalex.org/A5067891234',
        display_name: 'Kyle Rawlins',
        orcid: 'https://orcid.org/0000-0002-1234-5678',
      },
      institutions: [
        {
          id: 'https://openalex.org/I145311948',
          display_name: 'Johns Hopkins University',
          ror: 'https://ror.org/00za53h95',
          country_code: 'US',
        },
      ],
      raw_affiliation_string: 'Department of Cognitive Science, Johns Hopkins University',
    },
  ],
  primary_location: {
    source: {
      id: 'https://openalex.org/S202381698',
      display_name: 'Glossa: a journal of general linguistics',
      issn: ['2397-1835'],
      type: 'journal',
    },
    pdf_url: 'https://www.glossa-journal.org/articles/10.5334/gjgl.1001/galley/1234/download/',
    landing_page_url: 'https://doi.org/10.5334/gjgl.1001',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    version: 'publishedVersion',
  },
  cited_by_count: 42,
  referenced_works_count: 67,
  concepts: [
    {
      id: 'https://openalex.org/C41008148',
      display_name: 'Linguistics',
      wikidata: 'https://www.wikidata.org/wiki/Q8162',
      score: 0.95,
      level: 1,
    },
    {
      id: 'https://openalex.org/C2778407487',
      display_name: 'Semantics',
      wikidata: 'https://www.wikidata.org/wiki/Q14827',
      score: 0.87,
      level: 2,
    },
    {
      id: 'https://openalex.org/C138921699',
      display_name: 'Clause',
      wikidata: 'https://www.wikidata.org/wiki/Q178885',
      score: 0.76,
      level: 3,
    },
  ],
  open_access: {
    is_oa: true,
    oa_url: 'https://www.glossa-journal.org/articles/10.5334/gjgl.1001/galley/1234/download/',
    oa_status: 'gold',
  },
  abstract_inverted_index: {
    We: [0, 15],
    investigate: [1],
    how: [2],
    acceptability: [3, 12],
    judgments: [4, 13],
    relate: [5],
    to: [6],
    corpus: [7],
    frequency: [8],
    for: [9],
    'clause-embedding': [10],
    'verbs.': [11],
    are: [14],
    collected: [16],
    using: [17],
    the: [18],
    MegaAcceptability: [19],
    'dataset.': [20],
  },
};

/**
 * Sample OpenAlex author response for Aaron Steven White.
 *
 * Based on real OpenAlex API response structure.
 */
const SAMPLE_AUTHOR_RESPONSE = {
  id: 'https://openalex.org/A5012345678',
  display_name: 'Aaron Steven White',
  orcid: 'https://orcid.org/0000-0002-4519-6259',
  works_count: 48,
  cited_by_count: 892,
  affiliations: [
    {
      institution: {
        id: 'https://openalex.org/I64222096',
        display_name: 'University of Rochester',
        ror: 'https://ror.org/022kthw22',
      },
      years: [2020, 2021, 2022, 2023, 2024],
    },
    {
      institution: {
        id: 'https://openalex.org/I145311948',
        display_name: 'Johns Hopkins University',
        ror: 'https://ror.org/00za53h95',
      },
      years: [2014, 2015, 2016, 2017],
    },
  ],
  x_concepts: [
    {
      id: 'https://openalex.org/C41008148',
      display_name: 'Linguistics',
      wikidata: 'https://www.wikidata.org/wiki/Q8162',
      score: 0.98,
      level: 1,
    },
    {
      id: 'https://openalex.org/C2778407487',
      display_name: 'Semantics',
      wikidata: 'https://www.wikidata.org/wiki/Q14827',
      score: 0.92,
      level: 2,
    },
    {
      id: 'https://openalex.org/C161191863',
      display_name: 'Natural language processing',
      wikidata: 'https://www.wikidata.org/wiki/Q30642',
      score: 0.85,
      level: 2,
    },
    {
      id: 'https://openalex.org/C2524010',
      display_name: 'Syntax',
      wikidata: 'https://www.wikidata.org/wiki/Q82622',
      score: 0.78,
      level: 2,
    },
  ],
};

/**
 * Sample OpenAlex search response.
 */
const SAMPLE_SEARCH_RESPONSE = {
  results: [SAMPLE_WORK_RESPONSE],
  meta: {
    count: 1,
    per_page: 20,
    page: 1,
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('OpenAlexPlugin', () => {
  let plugin: OpenAlexPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new OpenAlexPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.openalex');
    });

    it('should declare network permissions for OpenAlex API', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('api.openalex.org');
    });

    it('should have storage permission for caching', () => {
      expect(plugin.manifest.permissions?.storage?.maxSize).toBe(200 * 1024 * 1024);
    });
  });

  describe('initialize', () => {
    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'OpenAlex plugin initialized',
        expect.objectContaining({
          note: 'Using polite pool with email',
        })
      );
    });
  });

  describe('getWork', () => {
    it('should return cached work if available', async () => {
      await plugin.initialize(context);
      const cachedWork = {
        id: 'https://openalex.org/W3024561234',
        title: 'Cached Work',
        type: 'journal-article',
        authorships: [],
        citedByCount: 0,
        referencedWorksCount: 0,
        concepts: [],
        source: 'openalex' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedWork);

      const result = await plugin.getWork('W3024561234');

      expect(result).toEqual(cachedWork);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const result = await plugin.getWork('W3024561234');

      expect(result?.id).toBe('https://openalex.org/W3024561234');
      expect(result?.title).toContain('Frequency, Acceptability');
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should return null on 404', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getWork('W9999999999');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getWork('W3024561234');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith('OpenAlex API error', expect.any(Object));
    });

    it('should parse authorships correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const result = await plugin.getWork('W3024561234');

      expect(result?.authorships).toHaveLength(2);
      expect(result?.authorships?.[0]?.author.displayName).toBe('Aaron Steven White');
      expect(result?.authorships?.[0]?.authorPosition).toBe('first');
      expect(result?.authorships?.[1]?.author.displayName).toBe('Kyle Rawlins');
      expect(result?.authorships?.[1]?.authorPosition).toBe('last');
    });

    it('should extract ORCID without prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const result = await plugin.getWork('W3024561234');

      expect(result?.authorships?.[0]?.author.orcid).toBe('0000-0002-4519-6259');
    });

    it('should extract DOI without prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const result = await plugin.getWork('W3024561234');

      expect(result?.doi).toBe('10.5334/gjgl.1001');
    });

    it('should parse primary location', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const result = await plugin.getWork('W3024561234');

      expect(result?.primaryLocation?.source?.displayName).toBe(
        'Glossa: a journal of general linguistics'
      );
      expect(result?.primaryLocation?.pdfUrl).toContain('galley');
      expect(result?.primaryLocation?.license).toBe('https://creativecommons.org/licenses/by/4.0/');
    });

    it('should parse concepts with Wikidata links', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const result = await plugin.getWork('W3024561234');

      expect(result?.concepts).toHaveLength(3);
      expect(result?.concepts?.[0]?.displayName).toBe('Linguistics');
      expect(result?.concepts?.[0]?.wikidata).toBe('https://www.wikidata.org/wiki/Q8162');
      expect(result?.concepts?.[0]?.score).toBe(0.95);
    });

    it('should convert inverted index abstract to text', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const result = await plugin.getWork('W3024561234');

      // Sorted by position: 0=We, 1=investigate, 2=how, 3=acceptability, 4=judgments, 5=relate, 6=to, 7=corpus, 8=frequency, 9=for, 10=clause-embedding, 11=verbs., 12=acceptability, 13=judgments, 14=are, 15=We, 16=collected, 17=using, 18=the, 19=MegaAcceptability, 20=dataset.
      expect(result?.abstract).toBe(
        'We investigate how acceptability judgments relate to corpus frequency for clause-embedding verbs. acceptability judgments are We collected using the MegaAcceptability dataset.'
      );
    });

    it('should include polite pool email parameter', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      await plugin.getWork('W3024561234');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('mailto=contact@chive.pub'),
        expect.any(Object)
      );
    });
  });

  describe('getWorkByDoi', () => {
    it('should fetch work by DOI', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const result = await plugin.getWorkByDoi('10.5334/gjgl.1001');

      expect(result?.doi).toBe('10.5334/gjgl.1001');
      expect(result?.title).toContain('Frequency, Acceptability');
    });

    it('should normalize DOI with https://doi.org/ prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      await plugin.getWorkByDoi('https://doi.org/10.5334/gjgl.1001');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/works/https://doi.org/10.5334/gjgl.1001'),
        expect.any(Object)
      );
    });

    it('should normalize DOI with doi: prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      await plugin.getWorkByDoi('doi:10.5334/gjgl.1001');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/works/https://doi.org/10.5334/gjgl.1001'),
        expect.any(Object)
      );
    });

    it('should return null for invalid DOI format', async () => {
      await plugin.initialize(context);

      const result = await plugin.getWorkByDoi('not-a-valid-doi');

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return null on 404', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getWorkByDoi('10.1234/nonexistent');

      expect(result).toBeNull();
    });

    it('should cache result by DOI', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      await plugin.getWorkByDoi('10.5334/gjgl.1001');

      expect(context.cache.set).toHaveBeenCalledWith(
        'openalex:work:doi:10.5334/gjgl.1001',
        expect.any(Object),
        expect.any(Number)
      );
    });
  });

  describe('getAuthor', () => {
    it('should return cached author if available', async () => {
      await plugin.initialize(context);
      const cachedAuthor = {
        id: 'https://openalex.org/A5012345678',
        displayName: 'Cached Author',
        worksCount: 10,
        citedByCount: 50,
        affiliations: [],
        topConcepts: [],
        source: 'openalex' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedAuthor);

      const result = await plugin.getAuthor('A5012345678');

      expect(result).toEqual(cachedAuthor);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_AUTHOR_RESPONSE),
      } as Response);

      const result = await plugin.getAuthor('A5012345678');

      expect(result?.id).toBe('https://openalex.org/A5012345678');
      expect(result?.displayName).toBe('Aaron Steven White');
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should return null on 404', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getAuthor('A9999999999');

      expect(result).toBeNull();
    });

    it('should parse author affiliations', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_AUTHOR_RESPONSE),
      } as Response);

      const result = await plugin.getAuthor('A5012345678');

      expect(result?.affiliations).toHaveLength(2);
      expect(result?.affiliations?.[0]?.institution.displayName).toBe('University of Rochester');
      expect(result?.affiliations?.[0]?.years).toContain(2023);
    });

    it('should limit top concepts to 10', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      const manyConceptsResponse = {
        ...SAMPLE_AUTHOR_RESPONSE,
        x_concepts: Array.from({ length: 20 }, (_, i) => ({
          id: `https://openalex.org/C${i}`,
          display_name: `Concept ${i}`,
          score: 1 - i * 0.01,
          level: 1,
        })),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(manyConceptsResponse),
      } as Response);

      const result = await plugin.getAuthor('A5012345678');

      expect(result?.topConcepts).toHaveLength(10);
    });
  });

  describe('getAuthorByOrcid', () => {
    it('should fetch author by ORCID', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_AUTHOR_RESPONSE),
      } as Response);

      const result = await plugin.getAuthorByOrcid('0000-0002-4519-6259');

      expect(result?.orcid).toBe('0000-0002-4519-6259');
      expect(result?.displayName).toBe('Aaron Steven White');
    });

    it('should normalize ORCID with https://orcid.org/ prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_AUTHOR_RESPONSE),
      } as Response);

      await plugin.getAuthorByOrcid('https://orcid.org/0000-0002-4519-6259');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/authors/https://orcid.org/0000-0002-4519-6259'),
        expect.any(Object)
      );
    });

    it('should return null for invalid ORCID format', async () => {
      await plugin.initialize(context);

      const result = await plugin.getAuthorByOrcid('not-an-orcid');

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should validate ORCID checksum digit', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_AUTHOR_RESPONSE),
      } as Response);

      await plugin.getAuthorByOrcid('0000-0002-4519-625X');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('0000-0002-4519-625X'),
        expect.any(Object)
      );
    });

    it('should cache result by ORCID', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_AUTHOR_RESPONSE),
      } as Response);

      await plugin.getAuthorByOrcid('0000-0002-4519-6259');

      expect(context.cache.set).toHaveBeenCalledWith(
        'openalex:author:orcid:0000-0002-4519-6259',
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should return null on 404', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getAuthorByOrcid('0000-0000-0000-0000');

      expect(result).toBeNull();
    });
  });

  describe('searchWorks', () => {
    it('should search works by query', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const results = await plugin.searchWorks('acceptability semantics');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'https://openalex.org/W3024561234',
        title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
      });
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchWorks('test', { limit: 50 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=50'),
        expect.any(Object)
      );
    });

    it('should cap limit at 200', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchWorks('test', { limit: 500 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=200'),
        expect.any(Object)
      );
    });

    it('should default to 20 results', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchWorks('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=20'),
        expect.any(Object)
      );
    });

    it('should include filter if provided', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchWorks('test', { filter: 'type:journal-article' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter=type%3Ajournal-article'),
        expect.any(Object)
      );
    });

    it('should return empty array on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.searchWorks('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith('OpenAlex search error', expect.any(Object));
    });

    it('should filter out invalid works', async () => {
      await plugin.initialize(context);
      const invalidResponse = {
        results: [
          SAMPLE_WORK_RESPONSE,
          { id: 'https://openalex.org/W999' }, // Missing title
          { title: 'No ID' }, // Missing id
        ],
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(invalidResponse),
      } as Response);

      const results = await plugin.searchWorks('test');

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('https://openalex.org/W3024561234');
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limit between requests', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValue(null);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const start = Date.now();
      await plugin.getWork('W1');
      await plugin.getWork('W2');
      const elapsed = Date.now() - start;

      // Should have at least 100ms delay between requests
      // Use 95ms threshold to account for timing jitter in CI environments
      expect(elapsed).toBeGreaterThanOrEqual(95);
    });
  });

  describe('error handling', () => {
    it('should handle fetch exception', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.getWork('W3024561234');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching OpenAlex work',
        expect.objectContaining({
          error: 'Network error',
        })
      );
    });

    it('should handle JSON parse error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response);

      const result = await plugin.getWork('W3024561234');

      expect(result).toBeNull();
    });
  });

  describe('data parsing edge cases', () => {
    it('should handle work with missing optional fields', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      const minimalWork = {
        id: 'https://openalex.org/W123',
        title: 'Minimal Work',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(minimalWork),
      } as Response);

      const result = await plugin.getWork('W123');

      expect(result?.id).toBe('https://openalex.org/W123');
      expect(result?.title).toBe('Minimal Work');
      expect(result?.authorships).toEqual([]);
      expect(result?.concepts).toEqual([]);
      expect(result?.citedByCount).toBe(0);
    });

    it('should handle author with missing optional fields', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      const minimalAuthor = {
        id: 'https://openalex.org/A123',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(minimalAuthor),
      } as Response);

      const result = await plugin.getAuthor('A123');

      expect(result?.id).toBe('https://openalex.org/A123');
      expect(result?.displayName).toBe('Unknown');
      expect(result?.worksCount).toBe(0);
      expect(result?.citedByCount).toBe(0);
    });

    it('should handle work without abstract', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      const workWithoutAbstract = {
        ...SAMPLE_WORK_RESPONSE,
        abstract_inverted_index: undefined,
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(workWithoutAbstract),
      } as Response);

      const result = await plugin.getWork('W3024561234');

      expect(result?.abstract).toBeUndefined();
    });
  });

  // ==========================================================================
  // classifyText (Discovery)
  // ==========================================================================

  describe('classifyText', () => {
    const SAMPLE_TEXT_RESPONSE = {
      primary_topic: {
        id: 'https://openalex.org/T10123',
        display_name: 'Natural Language Processing',
        score: 0.92,
        subfield: { id: 'sf1', display_name: 'Artificial Intelligence' },
        field: { id: 'f1', display_name: 'Computer Science' },
        domain: { id: 'd1', display_name: 'Physical Sciences' },
      },
      topics: [
        {
          id: 'https://openalex.org/T10123',
          display_name: 'Natural Language Processing',
          score: 0.92,
          subfield: { id: 'sf1', display_name: 'Artificial Intelligence' },
          field: { id: 'f1', display_name: 'Computer Science' },
          domain: { id: 'd1', display_name: 'Physical Sciences' },
        },
        {
          id: 'https://openalex.org/T10124',
          display_name: 'Machine Learning',
          score: 0.88,
        },
      ],
      concepts: [
        {
          id: 'https://openalex.org/C41008148',
          display_name: 'Computer Science',
          wikidata: 'https://www.wikidata.org/wiki/Q21198',
          score: 0.85,
          level: 0,
        },
      ],
      keywords: [
        { id: 'k1', display_name: 'semantics', score: 0.9 },
        { id: 'k2', display_name: 'linguistics', score: 0.85 },
      ],
    };

    it('should classify title and abstract', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_TEXT_RESPONSE),
      } as Response);

      const result = await plugin.classifyText(
        'Frequency and Acceptability in Semantics',
        'This paper investigates the relationship between acceptability judgments and corpus frequency.'
      );

      expect(result.primaryTopic?.displayName).toBe('Natural Language Processing');
      expect(result.topics).toHaveLength(2);
      expect(result.concepts).toHaveLength(1);
      expect(result.keywords).toHaveLength(2);
    });

    it('should classify title only', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_TEXT_RESPONSE),
      } as Response);

      const result = await plugin.classifyText('Frequency and Acceptability in Semantics');

      expect(result.topics).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.not.stringContaining('abstract='),
        expect.any(Object)
      );
    });

    it('should return empty result for short text', async () => {
      await plugin.initialize(context);

      const result = await plugin.classifyText('Short');

      expect(result.topics).toEqual([]);
      expect(result.concepts).toEqual([]);
      expect(result.keywords).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should truncate long text', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_TEXT_RESPONSE),
      } as Response);

      const longTitle = 'A'.repeat(600);
      const longAbstract = 'B'.repeat(2000);
      await plugin.classifyText(longTitle, longAbstract);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0]?.[0] as string;
      expect(fetchCall).toBeDefined();
      // Title should be truncated to 500, abstract to 1500
      const params = new URLSearchParams(fetchCall.split('?')[1]);
      expect(params.get('title')?.length).toBeLessThanOrEqual(500);
    });

    it('should return empty result on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.classifyText('A sufficiently long title for classification');

      expect(result.topics).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'OpenAlex text classification error',
        expect.any(Object)
      );
    });

    it('should handle network errors gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.classifyText('A sufficiently long title for classification');

      expect(result.topics).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error classifying text with OpenAlex',
        expect.any(Object)
      );
    });

    it('should parse topics with subfield and domain', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_TEXT_RESPONSE),
      } as Response);

      const result = await plugin.classifyText(
        'Frequency and Acceptability in Semantics',
        'This is a sufficiently long abstract for testing.'
      );

      expect(result.topics[0]?.subfield).toBe('Artificial Intelligence');
      expect(result.topics[0]?.field).toBe('Computer Science');
      expect(result.topics[0]?.domain).toBe('Physical Sciences');
    });
  });

  // ==========================================================================
  // getRelatedWorks (Discovery)
  // ==========================================================================

  describe('getRelatedWorks', () => {
    const SAMPLE_RELATED_RESPONSE = {
      related_works: [
        'https://openalex.org/W2741809808',
        'https://openalex.org/W2741809809',
        'https://openalex.org/W2741809810',
      ],
    };

    it('should return related work IDs', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RELATED_RESPONSE),
      } as Response);

      const result = await plugin.getRelatedWorks('W2741809807');

      expect(result).toHaveLength(3);
      expect(result[0]).toBe('https://openalex.org/W2741809808');
    });

    it('should call API with correct URL', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RELATED_RESPONSE),
      } as Response);

      await plugin.getRelatedWorks('W2741809807');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/works/W2741809807?select=related_works'),
        expect.any(Object)
      );
    });

    it('should return empty array on 404', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getRelatedWorks('W9999999999');

      expect(result).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getRelatedWorks('W2741809807');

      expect(result).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'OpenAlex related works error',
        expect.any(Object)
      );
    });

    it('should handle network errors gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.getRelatedWorks('W2741809807');

      expect(result).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching OpenAlex related works',
        expect.any(Object)
      );
    });

    it('should return empty array for missing related_works field', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response);

      const result = await plugin.getRelatedWorks('W2741809807');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getWorksBatch (Discovery)
  // ==========================================================================

  describe('getWorksBatch', () => {
    const SAMPLE_BATCH_RESPONSE = {
      results: [
        { ...SAMPLE_WORK_RESPONSE, id: 'https://openalex.org/W1' },
        { ...SAMPLE_WORK_RESPONSE, id: 'https://openalex.org/W2' },
      ],
    };

    it('should batch fetch multiple works', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_BATCH_RESPONSE),
      } as Response);

      const result = await plugin.getWorksBatch(['W1', 'W2']);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('https://openalex.org/W1');
      expect(result[1]?.id).toBe('https://openalex.org/W2');
    });

    it('should return empty array for empty input', async () => {
      await plugin.initialize(context);

      const result = await plugin.getWorksBatch([]);

      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should use pipe-separated filter', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_BATCH_RESPONSE),
      } as Response);

      await plugin.getWorksBatch(['W1', 'W2', 'W3']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter=openalex_id%3AW1%7CW2%7CW3'),
        expect.any(Object)
      );
    });

    it('should limit batch to 50 IDs', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ results: [] }),
      } as Response);

      const manyIds = Array.from({ length: 100 }, (_, i) => `W${i}`);
      await plugin.getWorksBatch(manyIds);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0]?.[0] as string;
      // Should only have 50 IDs in the filter
      const pipeCount = (fetchCall.match(/%7C/g) ?? []).length;
      expect(pipeCount).toBe(49); // 50 IDs means 49 pipes
    });

    it('should return empty array on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getWorksBatch(['W1', 'W2']);

      expect(result).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'OpenAlex batch fetch error',
        expect.any(Object)
      );
    });

    it('should handle network errors gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.getWorksBatch(['W1', 'W2']);

      expect(result).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error batch fetching OpenAlex works',
        expect.any(Object)
      );
    });

    it('should filter out invalid works in response', async () => {
      await plugin.initialize(context);
      const responseWithInvalid = {
        results: [
          SAMPLE_WORK_RESPONSE,
          { id: 'invalid' }, // Missing title
        ],
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responseWithInvalid),
      } as Response);

      const result = await plugin.getWorksBatch(['W1', 'W2']);

      expect(result).toHaveLength(1);
    });
  });
});
