/**
 * Unit tests for XRPC pub.chive.eprint.deleteSubmission handler.
 *
 * @remarks
 * Tests authorization logic for eprint deletion across both traditional
 * (submitter-owned) and paper-centric (paper account) models.
 *
 * Key scenarios:
 * - Traditional eprints: submitter can delete their own records
 * - Paper-centric eprints: only paper account can delete
 * - Authorization failures for non-owners
 * - NotFoundError for missing eprints
 * - ValidationError for invalid URIs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { deleteSubmission } from '@/api/handlers/xrpc/eprint/deleteSubmission.js';
import type { AuthContext } from '@/api/xrpc/types.js';
import type { EprintView } from '@/services/eprint/eprint-service.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
import { AuthorizationError, NotFoundError, ValidationError } from '@/types/errors.js';
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
const PAPER_DID = 'did:plc:paper456' as DID;
const OTHER_USER_DID = 'did:plc:otheruser789' as DID;

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

const createMockEprintService = (): MockEprintService => ({
  getEprint: vi.fn(),
});

describe('XRPC deleteSubmission Handler', () => {
  let mockLogger: ILogger;
  let mockEprintService: MockEprintService;
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
    mockContext = createMockContext({ did: SUBMITTER_DID });
  });

  describe('Traditional Eprints (no paperDid)', () => {
    it('successfully authorizes deletion when submitter owns the eprint', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await deleteSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(result.encoding).toBe('application/json');
      expect(result.body.success).toBe(true);
      expect(mockEprintService.getEprint).toHaveBeenCalledWith(eprint.uri);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Delete submission authorized',
        expect.objectContaining({
          uri: eprint.uri,
          did: SUBMITTER_DID,
          isPaperCentric: false,
        })
      );
    });

    it('throws AuthorizationError when non-owner tries to delete', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      // Create context with different user
      mockContext = createMockContext({ did: OTHER_USER_DID });

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri },
          auth: { did: OTHER_USER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri },
          auth: { did: OTHER_USER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Can only delete your own eprints');
    });
  });

  describe('Paper-Centric Eprints (with paperDid)', () => {
    it('successfully authorizes deletion when authenticated as paper account', async () => {
      const eprint = createMockEprint({
        paperDid: PAPER_DID,
        uri: `at://${PAPER_DID}/pub.chive.eprint.submission/abc123` as AtUri,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      // Create context with paper account user
      mockContext = createMockContext({ did: PAPER_DID });

      const result = await deleteSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri },
        auth: { did: PAPER_DID, iss: 'https://pds.chive.pub' } as AuthContext,
        c: mockContext as never,
      });

      expect(result.encoding).toBe('application/json');
      expect(result.body.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Delete submission authorized',
        expect.objectContaining({
          uri: eprint.uri,
          did: PAPER_DID,
          isPaperCentric: true,
        })
      );
    });

    it('throws AuthorizationError when submitter tries to delete paper-centric eprint', async () => {
      const eprint = createMockEprint({
        paperDid: PAPER_DID,
        submittedBy: SUBMITTER_DID,
        uri: `at://${PAPER_DID}/pub.chive.eprint.submission/abc123` as AtUri,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      // Submitter tries to delete, but paperDid requires paper account auth
      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Must authenticate as paper account to delete paper-centric eprints');
    });

    it('throws AuthorizationError when third party tries to delete paper-centric eprint', async () => {
      const eprint = createMockEprint({
        paperDid: PAPER_DID,
        submittedBy: SUBMITTER_DID,
        uri: `at://${PAPER_DID}/pub.chive.eprint.submission/abc123` as AtUri,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      // Create context with unrelated user
      mockContext = createMockContext({ did: OTHER_USER_DID });

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri },
          auth: { did: OTHER_USER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri },
          auth: { did: OTHER_USER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Can only delete your own eprints');
    });
  });

  describe('Error Handling', () => {
    it('throws NotFoundError when eprint does not exist', async () => {
      mockEprintService.getEprint.mockResolvedValue(null);

      const nonExistentUri = 'at://did:plc:notfound/pub.chive.eprint.submission/xyz' as AtUri;

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: nonExistentUri },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(NotFoundError);

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: nonExistentUri },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(`Eprint not found: ${nonExistentUri}`);
    });

    it('throws ValidationError when uri is missing', async () => {
      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: {} as { uri: string },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: {} as { uri: string },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing required parameter: uri');
    });

    it('throws ValidationError when request body is missing', async () => {
      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: undefined,
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: undefined,
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing request body');
    });

    it('throws AuthorizationError when user is not authenticated', async () => {
      // Create context with no user
      mockContext = createMockContext(null);

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: 'at://did:plc:test/pub.chive.eprint.submission/xyz' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(
        deleteSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: 'at://did:plc:test/pub.chive.eprint.submission/xyz' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Logging', () => {
    it('logs debug message with request details', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      await deleteSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Delete submission request', {
        uri: eprint.uri,
        did: SUBMITTER_DID,
      });
    });

    it('logs info message on successful authorization', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      await deleteSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Delete submission authorized',
        expect.objectContaining({
          uri: eprint.uri,
          did: SUBMITTER_DID,
          recordOwner: SUBMITTER_DID,
          isPaperCentric: false,
        })
      );
    });

    it('logs record owner correctly for paper-centric eprints', async () => {
      const eprint = createMockEprint({
        paperDid: PAPER_DID,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      mockContext = createMockContext({ did: PAPER_DID });

      await deleteSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri },
        auth: { did: PAPER_DID, iss: 'https://pds.chive.pub' } as AuthContext,
        c: mockContext as never,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Delete submission authorized',
        expect.objectContaining({
          recordOwner: PAPER_DID,
          isPaperCentric: true,
        })
      );
    });
  });
});
