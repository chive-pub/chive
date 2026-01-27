/**
 * Unit tests for XRPC pub.chive.eprint.getSubmission handler.
 *
 * @remarks
 * Tests retrieval of eprint submissions with schema hints for legacy formats.
 *
 * Key scenarios:
 * - Successful retrieval with full response
 * - Schema hints inclusion for legacy abstract format
 * - No schema hints for current abstract format
 * - NotFoundError for missing eprints
 * - ValidationError for invalid URIs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getSubmission } from '@/api/handlers/xrpc/eprint/getSubmission.js';
import type { EprintView } from '@/services/eprint/eprint-service.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
import { NotFoundError, ValidationError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { AnnotationBody } from '@/types/models/annotation.js';
import type { EprintAuthor } from '@/types/models/author.js';

/** Creates a mock rich text abstract from plain text. */
function createMockAbstract(text: string): AnnotationBody {
  return {
    type: 'RichText',
    items: [{ type: 'text', content: text }],
    format: 'application/x-chive-gloss+json',
  };
}

/** Creates a rich text abstract with multiple items. */
function createRichAbstract(): AnnotationBody {
  return {
    type: 'RichText',
    items: [
      { type: 'text', content: 'This paper explores ' },
      {
        type: 'nodeRef',
        uri: 'at://did:plc:gov/pub.chive.graph.node/quantum' as AtUri,
        label: 'quantum',
      },
      { type: 'text', content: ' computing advances.' },
    ],
    format: 'application/x-chive-gloss+json',
  };
}

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const VALID_CID = 'bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const VALID_BLOB_CID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
const SUBMITTER_DID = 'did:plc:submitter123' as DID;

const mockAuthor: EprintAuthor = {
  did: SUBMITTER_DID,
  name: 'Test Author',
  order: 1,
  affiliations: [],
  contributions: [],
  isCorrespondingAuthor: true,
  isHighlighted: false,
};

const createMockEprint = (overrides?: Partial<EprintView>): EprintView => ({
  uri: 'at://did:plc:submitter123/pub.chive.eprint.submission/abc123' as AtUri,
  cid: VALID_CID as CID,
  title: 'Quantum Computing Advances',
  abstract: createMockAbstract('This paper presents advances in quantum computing...'),
  abstractPlainText: 'This paper presents advances in quantum computing...',
  authors: [mockAuthor],
  submittedBy: SUBMITTER_DID,
  license: 'CC-BY-4.0',
  pdsUrl: 'https://bsky.social',
  documentBlobRef: {
    $type: 'blob',
    ref: VALID_BLOB_CID as CID,
    mimeType: 'application/pdf',
    size: 1024000,
  },
  documentFormat: 'pdf',
  publicationStatus: 'eprint',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  indexedAt: new Date('2024-01-15T10:05:00Z'),
  version: 1,
  versions: [
    {
      uri: 'at://did:plc:submitter123/pub.chive.eprint.submission/abc123' as AtUri,
      versionNumber: 1,
      cid: VALID_CID as CID,
      createdAt: Date.parse('2024-01-15T10:00:00Z') as Timestamp,
      changes: 'Initial submission',
    },
  ],
  metrics: {
    views: 150,
    downloads: 42,
    endorsements: 5,
  },
  ...overrides,
});

interface MockEprintService {
  getEprint: ReturnType<typeof vi.fn>;
}

interface MockMetricsService {
  recordView: ReturnType<typeof vi.fn>;
}

const createMockEprintService = (): MockEprintService => ({
  getEprint: vi.fn(),
});

const createMockMetricsService = (): MockMetricsService => ({
  recordView: vi.fn().mockResolvedValue(undefined),
});

describe('XRPC getSubmission Handler', () => {
  let mockLogger: ILogger;
  let mockEprintService: MockEprintService;
  let mockMetricsService: MockMetricsService;
  let mockContext: {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
  };

  const createMockContext = (
    user: { did: DID } | null
  ): { get: (key: string) => unknown; set: (key: string, value: unknown) => void } => ({
    get: vi.fn((key: string) => {
      switch (key) {
        case 'services':
          return {
            eprint: mockEprintService,
            metrics: mockMetricsService,
          };
        case 'logger':
          return mockLogger;
        case 'user':
          return user;
        default:
          return undefined;
      }
    }),
    set: vi.fn(),
  });

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEprintService = createMockEprintService();
    mockMetricsService = createMockMetricsService();
    mockContext = createMockContext(null);
  });

  describe('Successful Retrieval', () => {
    it('returns full eprint response with all fields', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.encoding).toBe('application/json');
      expect(result.body.uri).toBe(eprint.uri);
      expect(result.body.cid).toBe(eprint.cid);
      expect(result.body.value.title).toBe('Quantum Computing Advances');
      expect(result.body.value.submittedBy).toBe(SUBMITTER_DID);
      expect(result.body.pdsUrl).toBe('https://bsky.social');
      expect(result.body.indexedAt).toBe('2024-01-15T10:05:00.000Z');
    });

    it('transforms abstract items to lexicon format', async () => {
      const eprint = createMockEprint({
        abstract: createRichAbstract(),
        abstractPlainText: 'This paper explores quantum computing advances.',
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      // Type assertion needed because value is typed as { [_ in string]: unknown }
      const value = result.body.value as Record<string, unknown>;
      const abstractItems = value.abstract as unknown[];

      expect(abstractItems).toHaveLength(3);
      expect(abstractItems[0]).toEqual({
        $type: 'pub.chive.eprint.submission#textItem',
        type: 'text',
        content: 'This paper explores ',
      });
      expect(abstractItems[1]).toEqual({
        $type: 'pub.chive.eprint.submission#nodeRefItem',
        type: 'nodeRef',
        uri: 'at://did:plc:gov/pub.chive.graph.node/quantum',
        label: 'quantum',
        subkind: 'field',
      });
    });

    it('records view metric for authenticated user', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);
      mockContext = createMockContext({ did: SUBMITTER_DID });

      await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockMetricsService.recordView).toHaveBeenCalledWith(eprint.uri, SUBMITTER_DID);
    });

    it('records view metric for anonymous user', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);
      mockContext = createMockContext(null);

      await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockMetricsService.recordView).toHaveBeenCalledWith(eprint.uri, undefined);
    });

    it('continues on metric recording failure', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);
      mockMetricsService.recordView.mockRejectedValue(new Error('Metrics unavailable'));

      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      // Should still return the eprint successfully
      expect(result.body.uri).toBe(eprint.uri);
      // Wait for the promise to settle
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to record view', {
        error: 'Metrics unavailable',
      });
    });
  });

  describe('Schema Hints for Legacy Formats', () => {
    it('includes _schemaHints for legacy string abstract format', async () => {
      // When stored, legacy string abstracts appear as single-item arrays
      // where the content matches abstractPlainText exactly
      const plainText = 'This is a plain text abstract from legacy format.';
      const eprint = createMockEprint({
        abstract: createMockAbstract(plainText),
        abstractPlainText: plainText,
        // The needsAbstractMigration flag is set during indexing when the source
        // record had a plain string abstract
        needsAbstractMigration: true,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      // The handler detects this pattern as likely legacy
      expect(result.body._schemaHints).toBeDefined();
      expect(result.body._schemaHints?.schemaVersion).toBe('0.0.0');
      expect(result.body._schemaHints?.deprecatedFields).toContain('abstract');
      expect(result.body._schemaHints?.migrationAvailable).toBe(true);
      expect(result.body._schemaHints?.migrationUrl).toContain('abstract-richtext');
    });

    it('omits _schemaHints for current rich text format', async () => {
      // Rich text with multiple items or nodeRefs is clearly current format
      const eprint = createMockEprint({
        abstract: createRichAbstract(),
        abstractPlainText: 'This paper explores quantum computing advances.',
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body._schemaHints).toBeUndefined();
    });

    it('omits _schemaHints for empty abstract', async () => {
      const eprint = createMockEprint({
        abstract: {
          type: 'RichText',
          items: [],
          format: 'application/x-chive-gloss+json',
        },
        abstractPlainText: undefined,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body._schemaHints).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('throws NotFoundError when eprint does not exist', async () => {
      mockEprintService.getEprint.mockResolvedValue(null);

      const nonExistentUri = 'at://did:plc:notfound/pub.chive.eprint.submission/xyz' as AtUri;

      await expect(
        getSubmission.handler({
          params: { uri: nonExistentUri },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow(NotFoundError);

      await expect(
        getSubmission.handler({
          params: { uri: nonExistentUri },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow(`Eprint not found: ${nonExistentUri}`);
    });

    it('throws ValidationError when uri is missing', async () => {
      await expect(
        getSubmission.handler({
          params: {} as { uri: string },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        getSubmission.handler({
          params: {} as { uri: string },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing required parameter: uri');
    });
  });

  describe('Logging', () => {
    it('logs debug message with request uri', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Getting eprint submission', {
        uri: eprint.uri,
      });
    });
  });

  describe('Author Transformation', () => {
    it('transforms authors with all fields', async () => {
      const authorWithAll: EprintAuthor = {
        did: SUBMITTER_DID,
        name: 'Alice Researcher',
        order: 1,
        email: 'alice@example.com',
        orcid: '0000-0002-1825-0097',
        affiliations: [
          {
            name: 'University of Testing',
            rorId: 'https://ror.org/03yrm5c26',
            department: 'Computer Science',
          },
        ],
        contributions: [
          {
            typeUri: 'at://did:plc:gov/pub.chive.graph.concept/conceptualization' as AtUri,
            typeId: 'conceptualization',
            typeLabel: 'Conceptualization',
            degree: 'lead',
          },
        ],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      };

      const eprint = createMockEprint({ authors: [authorWithAll] });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      // Type assertion needed because value is typed as { [_ in string]: unknown }
      const value = result.body.value as Record<string, unknown>;
      const authors = value.authors as Record<string, unknown>[];
      const author = authors[0];

      expect(author).toBeDefined();
      expect(author?.did).toBe(SUBMITTER_DID);
      expect(author?.name).toBe('Alice Researcher');
      expect(author?.email).toBe('alice@example.com');
      expect(author?.orcid).toBe('0000-0002-1825-0097');
      const affiliations = author?.affiliations as Record<string, unknown>[];
      expect(affiliations).toHaveLength(1);
      expect(affiliations[0]?.name).toBe('University of Testing');
      const contributions = author?.contributions as Record<string, unknown>[];
      expect(contributions).toHaveLength(1);
      expect(contributions[0]?.degreeSlug).toBe('lead');
      expect(author?.isCorrespondingAuthor).toBe(true);
    });
  });

  describe('Supplementary Materials', () => {
    it('transforms supplementary materials with blob refs', async () => {
      // Use a valid CID (same format as VALID_BLOB_CID)
      const supplementaryCid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
      const eprint = createMockEprint({
        supplementaryMaterials: [
          {
            blobRef: {
              $type: 'blob',
              ref: supplementaryCid as CID,
              mimeType: 'text/csv',
              size: 5000,
            },
            label: 'Dataset A',
            description: 'Raw data from experiment',
            category: 'dataset',
            detectedFormat: 'csv',
            order: 1,
          },
        ],
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      // Type assertion needed because value is typed as { [_ in string]: unknown }
      const value = result.body.value as Record<string, unknown>;
      const materials = value.supplementaryMaterials as Record<string, unknown>[];

      expect(materials).toHaveLength(1);
      const material = materials[0];
      expect(material?.label).toBe('Dataset A');
      expect(material?.description).toBe('Raw data from experiment');
      expect(material?.categorySlug).toBe('dataset');
      expect(material?.detectedFormat).toBe('csv');
      expect(material?.order).toBe(1);
    });
  });
});
