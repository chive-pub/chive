/**
 * Unit tests for VersionManager.
 *
 * @remarks
 * Tests eprint version chain traversal, version history retrieval,
 * and circular reference detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { VersionManager } from '@/services/eprint/version-manager.js';
import { toTimestamp } from '@/types/atproto-validators.js';
import type { AtUri, BlobRef, CID, DID } from '@/types/atproto.js';
import { DatabaseError, NotFoundError } from '@/types/errors.js';
import type { IStorageBackend, StoredEprint } from '@/types/interfaces/storage.interface.js';
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

interface MockStorage {
  storage: IStorageBackend;
  getEprintMock: ReturnType<typeof vi.fn>;
}

const createMockStorage = (): MockStorage => {
  const getEprintMock = vi.fn().mockResolvedValue(null);
  const storage: IStorageBackend = {
    getEprint: getEprintMock,
    storeEprint: vi.fn(),
    getEprintsByAuthor: vi.fn(),
    trackPDSSource: vi.fn(),
    getRecordsNotSyncedSince: vi.fn(),
    isStale: vi.fn(),
  } as unknown as IStorageBackend;
  return {
    storage,
    getEprintMock,
  };
};

const mockAuthor: EprintAuthor = {
  did: 'did:plc:author' as DID,
  name: 'Test Author',
  order: 1,
  affiliations: [],
  contributions: [],
  isCorrespondingAuthor: true,
  isHighlighted: false,
};

const createMockStoredEprint = (overrides?: Partial<StoredEprint>): StoredEprint => ({
  uri: 'at://did:plc:author/pub.chive.eprint.submission/abc123' as AtUri,
  cid: 'bafyreicid123' as CID,
  authors: [mockAuthor],
  submittedBy: 'did:plc:author' as DID,
  title: 'Frequency, acceptability, and selection: A case study of clause-embedding',
  abstract: createMockAbstract(
    'We investigate the relationship between the frequency with which verbs are found in particular subcategorization frames and the acceptability of those verbs in those frames, focusing in particular on subordinate clause-taking verbs, such as think, want, and tell.'
  ),
  abstractPlainText:
    'We investigate the relationship between the frequency with which verbs are found in particular subcategorization frames and the acceptability of those verbs in those frames, focusing in particular on subordinate clause-taking verbs, such as think, want, and tell.',
  documentBlobRef: {
    $type: 'blob',
    ref: 'bafyreiabc123' as CID,
    mimeType: 'application/pdf',
    size: 1000,
  } as BlobRef,
  documentFormat: 'pdf',
  publicationStatus: 'eprint',
  previousVersionUri: undefined,
  versionNotes: undefined,
  license: 'CC-BY-4.0',
  pdsUrl: 'https://pds.host',
  indexedAt: new Date('2020-01-01T00:00:00Z'),
  createdAt: new Date('2020-01-01T00:00:00Z'),
  ...overrides,
});

describe('VersionManager', () => {
  let mockStorage: MockStorage;
  let manager: VersionManager;

  beforeEach(() => {
    mockStorage = createMockStorage();
    manager = new VersionManager({ storage: mockStorage.storage });
  });

  describe('getVersionChain', () => {
    it('returns single version for eprint without previous versions', async () => {
      const eprint = createMockStoredEprint();
      mockStorage.getEprintMock.mockResolvedValue(eprint);

      const chain = await manager.getVersionChain(eprint.uri);

      expect(chain.totalVersions).toBe(1);
      expect(chain.versions).toHaveLength(1);
      expect(chain.latest.uri).toBe(eprint.uri);
      expect(chain.latest.versionNumber).toBe(1);
    });

    it('builds chain for eprint with previous versions', async () => {
      const v1 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v1' as AtUri,
        cid: 'bafyreiv1' as CID,
        previousVersionUri: undefined,
        versionNotes: undefined,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });

      const v2 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v2' as AtUri,
        cid: 'bafyreiv2' as CID,
        previousVersionUri: v1.uri,
        versionNotes: 'Extended analysis to include factive predicates',
        createdAt: new Date('2020-02-01T00:00:00Z'),
      });

      const v3 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v3' as AtUri,
        cid: 'bafyreiv3' as CID,
        previousVersionUri: v2.uri,
        versionNotes: 'Added cross-linguistic comparison section',
        createdAt: new Date('2020-03-01T00:00:00Z'),
      });

      mockStorage.getEprintMock.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        (uri: AtUri): Promise<StoredEprint | null> =>
          Promise.resolve(uri === v1.uri ? v1 : uri === v2.uri ? v2 : uri === v3.uri ? v3 : null)
      );

      const chain = await manager.getVersionChain(v3.uri);

      expect(chain.totalVersions).toBe(3);
      expect(chain.versions).toHaveLength(3);

      const version0 = chain.versions[0];
      const version1 = chain.versions[1];
      const version2 = chain.versions[2];

      if (!version0 || !version1 || !version2) {
        throw new Error('Expected 3 versions in chain');
      }

      expect(version0.uri).toBe(v1.uri);
      expect(version0.versionNumber).toBe(1);
      expect(version1.uri).toBe(v2.uri);
      expect(version1.versionNumber).toBe(2);
      expect(version2.uri).toBe(v3.uri);
      expect(version2.versionNumber).toBe(3);
      expect(chain.latest.uri).toBe(v3.uri);
    });

    it('builds complete chain when starting from latest version', async () => {
      const v1 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v1' as AtUri,
        cid: 'bafyreiv1' as CID,
        previousVersionUri: undefined,
      });

      const v2 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v2' as AtUri,
        cid: 'bafyreiv2' as CID,
        previousVersionUri: v1.uri,
      });

      mockStorage.getEprintMock.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        (uri: AtUri): Promise<StoredEprint | null> =>
          Promise.resolve(uri === v1.uri ? v1 : uri === v2.uri ? v2 : null)
      );

      const chain = await manager.getVersionChain(v2.uri);

      expect(chain.totalVersions).toBe(2);
      expect(chain.latest.uri).toBe(v2.uri);
      expect(chain.versions[0]?.uri).toBe(v1.uri);
      expect(chain.versions[1]?.uri).toBe(v2.uri);
    });

    it('throws NotFoundError when version not found', async () => {
      mockStorage.getEprintMock.mockResolvedValue(null);

      const uri = 'at://did:plc:author/pub.chive.eprint.submission/nonexistent' as AtUri;

      await expect(manager.getVersionChain(uri)).rejects.toThrow(NotFoundError);
    });

    it('throws DatabaseError when version chain exceeds max length', async () => {
      const managerWithLimit = new VersionManager({ storage: mockStorage.storage, maxVersions: 3 });

      mockStorage.getEprintMock.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        (): Promise<StoredEprint | null> =>
          Promise.resolve(
            createMockStoredEprint({
              previousVersionUri: 'at://did:plc:author/pub.chive.eprint.submission/prev' as AtUri,
            })
          )
      );

      const uri = 'at://did:plc:author/pub.chive.eprint.submission/current' as AtUri;

      await expect(managerWithLimit.getVersionChain(uri)).rejects.toThrow(DatabaseError);
      await expect(managerWithLimit.getVersionChain(uri)).rejects.toThrow(
        'Version chain exceeded max length'
      );
    });

    it('includes version notes in chain', async () => {
      const v1 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v1' as AtUri,
        versionNotes: undefined,
      });

      const v2 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v2' as AtUri,
        previousVersionUri: v1.uri,
        versionNotes: 'Revised semantic selectional restrictions analysis',
      });

      mockStorage.getEprintMock.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        (uri: AtUri): Promise<StoredEprint | null> =>
          Promise.resolve(uri === v1.uri ? v1 : uri === v2.uri ? v2 : null)
      );

      const chain = await manager.getVersionChain(v2.uri);

      const v1Result = chain.versions[0];
      const v2Result = chain.versions[1];

      if (!v1Result || !v2Result) {
        throw new Error('Expected 2 versions in chain');
      }

      expect(v1Result.changes).toBe('');
      expect(v2Result.changes).toBe('Revised semantic selectional restrictions analysis');
    });
  });

  describe('getVersion', () => {
    it('returns version with correct position in chain', async () => {
      const v1 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v1' as AtUri,
        cid: 'bafyreiv1' as CID,
        previousVersionUri: undefined,
      });

      const v2 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v2' as AtUri,
        cid: 'bafyreiv2' as CID,
        previousVersionUri: v1.uri,
      });

      mockStorage.getEprintMock.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        (uri: AtUri): Promise<StoredEprint | null> =>
          Promise.resolve(uri === v1.uri ? v1 : uri === v2.uri ? v2 : null)
      );

      const version = await manager.getVersion(v2.uri);

      if (!version) {
        throw new Error('Expected version to be found');
      }

      expect(version.uri).toBe(v2.uri);
      expect(version.versionNumber).toBe(2);
      expect(version.previousVersionUri).toBe(v1.uri);
    });

    it('returns null when version not found', async () => {
      mockStorage.getEprintMock.mockResolvedValue(null);

      const uri = 'at://did:plc:author/pub.chive.eprint.submission/nonexistent' as AtUri;
      const version = await manager.getVersion(uri);

      expect(version).toBeNull();
    });

    it('throws DatabaseError when version not in its own chain', async () => {
      const eprint = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri,
      });

      mockStorage.getEprintMock.mockResolvedValue(eprint);

      const managerSpy = vi.spyOn(manager, 'getVersionChain').mockResolvedValue({
        versions: [],
        latest: {
          uri: 'at://did:plc:author/pub.chive.eprint.submission/other' as AtUri,
          cid: 'bafyreicid' as CID,
          versionNumber: 1,
          changes: '',
          createdAt: toTimestamp(new Date()),
        },
        totalVersions: 1,
      });

      await expect(manager.getVersion(eprint.uri)).rejects.toThrow(DatabaseError);
      await expect(manager.getVersion(eprint.uri)).rejects.toThrow('not found in its own chain');

      managerSpy.mockRestore();
    });
  });

  describe('getLatestVersion', () => {
    it('returns latest version when starting from latest', async () => {
      const v1 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v1' as AtUri,
        cid: 'bafyreiv1' as CID,
        previousVersionUri: undefined,
      });

      const v2 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v2' as AtUri,
        cid: 'bafyreiv2' as CID,
        previousVersionUri: v1.uri,
      });

      const v3 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v3' as AtUri,
        cid: 'bafyreiv3' as CID,
        previousVersionUri: v2.uri,
      });

      mockStorage.getEprintMock.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        (uri: AtUri): Promise<StoredEprint | null> =>
          Promise.resolve(uri === v1.uri ? v1 : uri === v2.uri ? v2 : uri === v3.uri ? v3 : null)
      );

      const latest = await manager.getLatestVersion(v3.uri);

      expect(latest.uri).toBe(v3.uri);
      expect(latest.versionNumber).toBe(3);
    });
  });

  describe('isLatestVersion', () => {
    it('returns true for latest version', async () => {
      const v1 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v1' as AtUri,
        previousVersionUri: undefined,
      });

      const v2 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v2' as AtUri,
        previousVersionUri: v1.uri,
      });

      mockStorage.getEprintMock.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        (uri: AtUri): Promise<StoredEprint | null> =>
          Promise.resolve(uri === v1.uri ? v1 : uri === v2.uri ? v2 : null)
      );

      const isV2Latest = await manager.isLatestVersion(v2.uri);

      expect(isV2Latest).toBe(true);
    });

    it('returns true for single version eprint', async () => {
      const v1 = createMockStoredEprint({
        uri: 'at://did:plc:author/pub.chive.eprint.submission/v1' as AtUri,
        previousVersionUri: undefined,
      });

      mockStorage.getEprintMock.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        (uri: AtUri): Promise<StoredEprint | null> => Promise.resolve(uri === v1.uri ? v1 : null)
      );

      const isV1Latest = await manager.isLatestVersion(v1.uri);

      expect(isV1Latest).toBe(true);
    });
  });
});
