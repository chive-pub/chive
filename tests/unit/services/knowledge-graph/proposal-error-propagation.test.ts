/**
 * Unit tests for proposal read-failure propagation.
 *
 * @remarks
 * `listProposals` used to swallow every error and return an empty page, which
 * the UI renders as "no proposals found" with HTTP 200 and which the moderation
 * badge reads as a zero backlog; `getProposalById` used to return null, which
 * handlers turn into a 404. Both now surface a typed error so callers can
 * answer 5xx, while a genuinely absent proposal still reads as null.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

import { KnowledgeGraphService } from '@/services/knowledge-graph/graph-service.js';
import { DatabaseError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const RKEY = '3mlbhk6h2ne2k';
const URI = `at://did:plc:izttpdp3l6vss5crelt5kcux/pub.chive.graph.nodeProposal/${RKEY}`;

const createLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

describe('KnowledgeGraphService proposal read failures', () => {
  let graph: {
    listProposals: ReturnType<typeof vi.fn>;
    getProposal: ReturnType<typeof vi.fn>;
    getProposalByRkey: ReturnType<typeof vi.fn>;
  };
  let logger: ILogger;
  let service: KnowledgeGraphService;

  beforeEach(() => {
    vi.clearAllMocks();
    graph = {
      listProposals: vi.fn(),
      getProposal: vi.fn().mockResolvedValue(null),
      getProposalByRkey: vi.fn().mockResolvedValue(null),
    };
    logger = createLogger();
    service = new KnowledgeGraphService({ graph: graph as never, logger } as never);
  });

  describe('listProposals', () => {
    it('should propagate a graph outage as a DatabaseError', async () => {
      graph.listProposals.mockRejectedValue(new Error('Neo4j unavailable'));

      await expect(service.listProposals({})).rejects.toBeInstanceOf(DatabaseError);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should preserve a typed error raised by the adapter', async () => {
      const adapterError = new DatabaseError('QUERY', 'connection pool exhausted');
      graph.listProposals.mockRejectedValue(adapterError);

      await expect(service.listProposals({})).rejects.toBe(adapterError);
    });

    it('should still return an empty page when the graph holds no proposals', async () => {
      graph.listProposals.mockResolvedValue({ proposals: [], total: 0, hasMore: false, offset: 0 });

      const result = await service.listProposals({});

      expect(result).toEqual({
        proposals: [],
        cursor: undefined,
        hasMore: false,
        total: 0,
      });
    });
  });

  describe('getProposalById', () => {
    it('should propagate a read failure rather than reporting the proposal as missing', async () => {
      graph.getProposalByRkey.mockRejectedValue(new Error('Neo4j unavailable'));

      await expect(service.getProposalById(RKEY)).rejects.toBeInstanceOf(DatabaseError);
    });

    it('should propagate a read failure for the AT-URI lookup too', async () => {
      graph.getProposal.mockRejectedValue(new Error('Neo4j unavailable'));

      await expect(service.getProposalById(URI)).rejects.toBeInstanceOf(DatabaseError);
    });

    it('should still return null when the proposal genuinely does not exist', async () => {
      expect(await service.getProposalById(RKEY)).toBeNull();
    });
  });
});
