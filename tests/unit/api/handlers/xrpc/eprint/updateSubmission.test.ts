/**
 * Unit tests for XRPC pub.chive.eprint.updateSubmission handler.
 *
 * @remarks
 * Tests authorization logic and version computation for eprint updates
 * across both traditional (submitter-owned) and paper-centric (paper account) models.
 *
 * Key scenarios:
 * - Version bumping (major, minor, patch)
 * - Authorization checks for traditional and paper-centric eprints
 * - Integer-to-semantic version conversion
 * - expectedCid response for optimistic concurrency control
 * - Changelog handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { updateSubmission } from '@/api/handlers/xrpc/eprint/updateSubmission.js';
import type { AuthContext } from '@/api/xrpc/types.js';
import type { EprintView } from '@/services/eprint/eprint-service.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
import { AuthorizationError, NotFoundError, ValidationError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { SemanticVersion } from '@/types/interfaces/storage.interface.js';
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

describe('XRPC updateSubmission Handler', () => {
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

  describe('Version Bumping', () => {
    describe('Major Version Bump', () => {
      it('bumps major version and resets minor and patch to 0', async () => {
        const eprint = createMockEprint({
          version: { major: 1, minor: 2, patch: 3 } as SemanticVersion,
        });
        mockEprintService.getEprint.mockResolvedValue(eprint);

        const result = await updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'major' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        });

        expect(result.body.version).toEqual({ major: 2, minor: 0, patch: 0 });
      });
    });

    describe('Minor Version Bump', () => {
      it('bumps minor version and resets patch to 0', async () => {
        const eprint = createMockEprint({
          version: { major: 1, minor: 2, patch: 3 } as SemanticVersion,
        });
        mockEprintService.getEprint.mockResolvedValue(eprint);

        const result = await updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'minor' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        });

        expect(result.body.version).toEqual({ major: 1, minor: 3, patch: 0 });
      });
    });

    describe('Patch Version Bump', () => {
      it('bumps patch version only', async () => {
        const eprint = createMockEprint({
          version: { major: 1, minor: 2, patch: 3 } as SemanticVersion,
        });
        mockEprintService.getEprint.mockResolvedValue(eprint);

        const result = await updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'patch' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        });

        expect(result.body.version).toEqual({ major: 1, minor: 2, patch: 4 });
      });
    });

    describe('Integer Version Conversion', () => {
      it('converts integer version to semantic before bumping major', async () => {
        const eprint = createMockEprint({
          version: 3, // Integer version
        });
        mockEprintService.getEprint.mockResolvedValue(eprint);

        const result = await updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'major' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        });

        // Integer 3 becomes { major: 3, minor: 0, patch: 0 }, then major bump gives 4.0.0
        expect(result.body.version).toEqual({ major: 4, minor: 0, patch: 0 });
      });

      it('converts integer version to semantic before bumping minor', async () => {
        const eprint = createMockEprint({
          version: 2,
        });
        mockEprintService.getEprint.mockResolvedValue(eprint);

        const result = await updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'minor' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        });

        // Integer 2 becomes { major: 2, minor: 0, patch: 0 }, then minor bump gives 2.1.0
        expect(result.body.version).toEqual({ major: 2, minor: 1, patch: 0 });
      });

      it('converts integer version to semantic before bumping patch', async () => {
        const eprint = createMockEprint({
          version: 1,
        });
        mockEprintService.getEprint.mockResolvedValue(eprint);

        const result = await updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'patch' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        });

        // Integer 1 becomes { major: 1, minor: 0, patch: 0 }, then patch bump gives 1.0.1
        expect(result.body.version).toEqual({ major: 1, minor: 0, patch: 1 });
      });
    });

    describe('Undefined Version', () => {
      it('defaults to 1.0.0 when version is undefined and bumps correctly', async () => {
        const eprint = createMockEprint({
          version: undefined as unknown as number,
        });
        mockEprintService.getEprint.mockResolvedValue(eprint);

        const result = await updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'minor' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        });

        // Defaults to 1.0.0, then minor bump gives 1.1.0
        expect(result.body.version).toEqual({ major: 1, minor: 1, patch: 0 });
      });
    });
  });

  describe('Expected CID Response', () => {
    it('returns expectedCid matching the current indexed CID', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await updateSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri, versionBump: 'patch' },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(result.body.expectedCid).toBe(VALID_CID);
    });

    it('returns different expectedCid for different eprints', async () => {
      const differentCid = 'bafyreibmwlkhwfibh3cnwhfgtajokcd5qoqkn4uqhdqawwkcvd6hqttnra';
      const eprint = createMockEprint({
        cid: differentCid as CID,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await updateSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri, versionBump: 'patch' },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(result.body.expectedCid).toBe(differentCid);
    });
  });

  describe('Response Structure', () => {
    it('returns correct response structure', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await updateSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri, versionBump: 'minor' },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(result.encoding).toBe('application/json');
      expect(result.body).toEqual({
        uri: eprint.uri,
        version: { major: 1, minor: 1, patch: 0 },
        expectedCid: VALID_CID,
      });
    });
  });

  describe('Authorization - Traditional Eprints (no paperDid)', () => {
    it('successfully authorizes update when submitter owns the eprint', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await updateSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri, versionBump: 'patch' },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(result.body.uri).toBe(eprint.uri);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Update submission authorized',
        expect.objectContaining({
          uri: eprint.uri,
          did: SUBMITTER_DID,
          isPaperCentric: false,
        })
      );
    });

    it('throws AuthorizationError when non-owner tries to update', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      mockContext = createMockContext({ did: OTHER_USER_DID });

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'patch' },
          auth: { did: OTHER_USER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'patch' },
          auth: { did: OTHER_USER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Can only edit your own eprints');
    });
  });

  describe('Authorization - Paper-Centric Eprints (with paperDid)', () => {
    it('successfully authorizes update when authenticated as paper account', async () => {
      const eprint = createMockEprint({
        paperDid: PAPER_DID,
        uri: `at://${PAPER_DID}/pub.chive.eprint.submission/abc123` as AtUri,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      mockContext = createMockContext({ did: PAPER_DID });

      const result = await updateSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri, versionBump: 'minor' },
        auth: { did: PAPER_DID, iss: 'https://pds.chive.pub' } as AuthContext,
        c: mockContext as never,
      });

      expect(result.body.uri).toBe(eprint.uri);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Update submission authorized',
        expect.objectContaining({
          uri: eprint.uri,
          did: PAPER_DID,
          isPaperCentric: true,
        })
      );
    });

    it('throws AuthorizationError when submitter tries to update paper-centric eprint', async () => {
      const eprint = createMockEprint({
        paperDid: PAPER_DID,
        submittedBy: SUBMITTER_DID,
        uri: `at://${PAPER_DID}/pub.chive.eprint.submission/abc123` as AtUri,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'patch' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'patch' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Must authenticate as paper account to edit paper-centric eprints');
    });

    it('throws AuthorizationError when third party tries to update paper-centric eprint', async () => {
      const eprint = createMockEprint({
        paperDid: PAPER_DID,
        submittedBy: SUBMITTER_DID,
        uri: `at://${PAPER_DID}/pub.chive.eprint.submission/abc123` as AtUri,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      mockContext = createMockContext({ did: OTHER_USER_DID });

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'patch' },
          auth: { did: OTHER_USER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'patch' },
          auth: { did: OTHER_USER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Can only edit your own eprints');
    });
  });

  describe('Error Handling', () => {
    it('throws NotFoundError when eprint does not exist', async () => {
      mockEprintService.getEprint.mockResolvedValue(null);

      const nonExistentUri = 'at://did:plc:notfound/pub.chive.eprint.submission/xyz' as AtUri;

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: nonExistentUri, versionBump: 'patch' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(NotFoundError);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: nonExistentUri, versionBump: 'patch' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(`Eprint not found: ${nonExistentUri}`);
    });

    it('throws ValidationError when uri is missing', async () => {
      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { versionBump: 'patch' } as { uri: string; versionBump: string },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { versionBump: 'patch' } as { uri: string; versionBump: string },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing required parameter: uri');
    });

    it('throws ValidationError when versionBump is missing', async () => {
      const eprint = createMockEprint();

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri } as unknown as { uri: string; versionBump: string },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri } as unknown as { uri: string; versionBump: string },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing required parameter: versionBump');
    });

    it('throws ValidationError when versionBump has invalid value', async () => {
      const eprint = createMockEprint();

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'invalid' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: eprint.uri, versionBump: 'invalid' },
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('versionBump must be one of: major, minor, patch');
    });

    it('throws ValidationError when request body is missing', async () => {
      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: undefined,
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: undefined,
          auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing request body');
    });

    it('throws AuthorizationError when user is not authenticated', async () => {
      mockContext = createMockContext(null);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: 'at://did:plc:test/pub.chive.eprint.submission/xyz', versionBump: 'patch' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(
        updateSubmission.handler({
          params: undefined as unknown as void,
          input: { uri: 'at://did:plc:test/pub.chive.eprint.submission/xyz', versionBump: 'patch' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Changelog Handling', () => {
    it('accepts request with changelog provided', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      // The handler validates input but changelog is passed through for frontend use
      const result = await updateSubmission.handler({
        params: undefined as unknown as void,
        input: {
          uri: eprint.uri,
          versionBump: 'minor',
          changelog: {
            summary: 'Added new analysis section',
          },
        },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      // Handler returns version info; changelog is used by frontend when creating actual update
      expect(result.body.version).toEqual({ major: 1, minor: 1, patch: 0 });
    });

    it('works without changelog provided', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await updateSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri, versionBump: 'patch' },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(result.body.version).toEqual({ major: 1, minor: 0, patch: 1 });
    });
  });

  describe('Logging', () => {
    it('logs debug message with request details', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      await updateSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri, versionBump: 'minor' },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Update submission request', {
        uri: eprint.uri,
        versionBump: 'minor',
        did: SUBMITTER_DID,
      });
    });

    it('logs info message with version details on successful authorization', async () => {
      const eprint = createMockEprint({
        version: { major: 2, minor: 3, patch: 4 } as SemanticVersion,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      await updateSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri, versionBump: 'minor' },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Update submission authorized',
        expect.objectContaining({
          uri: eprint.uri,
          did: SUBMITTER_DID,
          recordOwner: SUBMITTER_DID,
          isPaperCentric: false,
          currentVersion: { major: 2, minor: 3, patch: 4 },
          newVersion: { major: 2, minor: 4, patch: 0 },
        })
      );
    });

    it('logs integer version as converted semantic version', async () => {
      const eprint = createMockEprint({
        version: 5,
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      await updateSubmission.handler({
        params: undefined as unknown as void,
        input: { uri: eprint.uri, versionBump: 'patch' },
        auth: { did: SUBMITTER_DID, iss: 'https://bsky.social' } as AuthContext,
        c: mockContext as never,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Update submission authorized',
        expect.objectContaining({
          currentVersion: { major: 5, minor: 0, patch: 0 },
          newVersion: { major: 5, minor: 0, patch: 1 },
        })
      );
    });
  });
});
