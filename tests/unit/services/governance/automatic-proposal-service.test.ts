/**
 * Unit tests for AutomaticProposalService.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AutomaticProposalService } from '../../../../src/services/governance/automatic-proposal-service.js';
import { GovernancePDSWriter } from '../../../../src/services/governance/governance-pds-writer.js';
import type { AtUri, CID, DID, Timestamp } from '../../../../src/types/atproto.js';
import type { IGraphDatabase } from '../../../../src/types/interfaces/graph.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type { Eprint } from '../../../../src/types/models/eprint.js';

describe('AutomaticProposalService', () => {
  let service: AutomaticProposalService;
  let mockPool: Pool;
  let mockGraph: IGraphDatabase;
  let mockLogger: ILogger;
  let mockGovernancePdsWriter: GovernancePDSWriter;
  let mockRedis: Redis;
  const graphPdsDid = 'did:plc:test' as DID;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    } as unknown as Pool;

    mockGraph = {
      getNodeByUri: vi.fn(),
      searchNodes: vi.fn(),
    } as unknown as IGraphDatabase;

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger;

    mockRedis = {} as unknown as Redis;

    mockGovernancePdsWriter = new GovernancePDSWriter({
      graphPdsDid,
      pdsUrl: 'https://governance.test',
      signingKey: 'test-key',
      pool: mockPool,
      cache: mockRedis,
      logger: mockLogger,
    });

    service = new AutomaticProposalService({
      pool: mockPool,
      graph: mockGraph,
      logger: mockLogger,
      governancePdsWriter: mockGovernancePdsWriter,
      graphPdsDid,
    });
  });

  describe('createAuthorProposal', () => {
    it('should skip proposal if author has no DID', async () => {
      const author = {
        name: 'Test Author',
        order: 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: false,
        isHighlighted: false,
      };
      const eprintUri = 'at://did:plc:test/pub.chive.eprint.submission/123' as AtUri;

      const result = await service.createAuthorProposal(author, eprintUri);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipping author proposal: no ATProto DID',
        expect.any(Object)
      );
    });

    it('should skip proposal if author node already exists', async () => {
      const author = {
        name: 'Test Author',
        did: 'did:plc:author123' as DID,
        order: 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: false,
        isHighlighted: false,
      };
      const eprintUri = 'at://did:plc:test/pub.chive.eprint.submission/123' as AtUri;

      vi.mocked(mockGraph.getNodeByUri).mockResolvedValue({
        id: 'd4e5f6a7-b8c9-0123-def0-123456789abc',
        uri: 'at://did:plc:test/pub.chive.graph.node/d4e5f6a7-b8c9-0123-def0-123456789abc' as AtUri,
        kind: 'object',
        subkind: 'author',
        label: 'Test Author',
        status: 'established',
        createdAt: new Date(),
      });

      const result = await service.createAuthorProposal(author, eprintUri);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipping author proposal: node already exists',
        expect.any(Object)
      );
    });

    it('should skip proposal if not first eprint submission', async () => {
      const author = {
        name: 'Test Author',
        did: 'did:plc:author123' as DID,
        order: 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: false,
        isHighlighted: false,
      };
      const eprintUri = 'at://did:plc:test/pub.chive.eprint.submission/123' as AtUri;

      vi.mocked(mockGraph.getNodeByUri).mockResolvedValue(null);
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [{ count: '2' }],
      } as unknown as Awaited<ReturnType<Pool['query']>>);

      const result = await service.createAuthorProposal(author, eprintUri);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipping author proposal: not first eprint',
        expect.any(Object)
      );
    });
  });

  describe('createEprintProposal', () => {
    it('should skip proposal if eprint node already exists', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123' as AtUri,
        cid: 'bafyreiabc123' as CID,
        title: 'Test Paper',
        authors: [],
        submittedBy: 'did:plc:test' as DID,
        abstract: {
          type: 'RichText',
          items: [{ type: 'text', content: 'Test abstract' }],
          format: 'application/x-chive-gloss+json',
        },
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiabc123' as CID,
          mimeType: 'application/pdf',
          size: 1024,
        },
        documentFormat: 'pdf',
        keywords: [],
        facets: [],
        fields: [],
        version: 1,
        license: 'CC-BY-4.0',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };
      const eprintUri = 'at://did:plc:test/pub.chive.eprint.submission/123' as AtUri;

      vi.mocked(mockGraph.getNodeByUri).mockResolvedValue({
        id: 'e5f6a7b8-c9d0-1234-ef01-23456789abcd',
        uri: 'at://did:plc:test/pub.chive.graph.node/e5f6a7b8-c9d0-1234-ef01-23456789abcd' as AtUri,
        kind: 'object',
        subkind: 'eprint',
        label: 'Test Paper',
        status: 'established',
        createdAt: new Date(),
      });

      const result = await service.createEprintProposal(eprint, eprintUri);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipping eprint proposal: node already exists',
        expect.any(Object)
      );
    });
  });

  describe('createInstitutionProposal', () => {
    it('should skip proposal if institution already exists', async () => {
      const name = 'MIT';
      const rorId = 'https://ror.org/123';
      const triggerUri = 'at://did:plc:test/pub.chive.eprint.submission/123' as AtUri;

      vi.mocked(mockGraph.searchNodes).mockResolvedValue({
        nodes: [
          {
            id: 'f6a7b8c9-d0e1-2345-f012-3456789abcde',
            uri: 'at://did:plc:test/pub.chive.graph.node/f6a7b8c9-d0e1-2345-f012-3456789abcde' as AtUri,
            kind: 'object',
            subkind: 'institution',
            label: 'MIT',
            status: 'established',
            createdAt: new Date(),
            externalIds: [{ system: 'ror', identifier: '123' }],
          },
        ],
        total: 1,
        hasMore: false,
      });

      const result = await service.createInstitutionProposal(name, rorId, triggerUri, 'eprint');

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipping institution proposal: node already exists',
        expect.any(Object)
      );
    });
  });
});
