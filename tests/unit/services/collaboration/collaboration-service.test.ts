/**
 * Unit tests for CollaborationService.
 *
 * @remarks
 * Verifies: invite/acceptance indexing, active-collaborator derivation,
 * revocation semantics, and out-of-order firehose handling.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import type { Pool, QueryResultRow } from 'pg';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CollaborationService } from '../../../../src/services/collaboration/collaboration-service.js';
import type { AtUri, CID, DID } from '../../../../src/types/atproto.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import { isOk } from '../../../../src/types/result.js';

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

/**
 * Minimal programmable mock Pool that records queries and returns configured
 * responses in order. Enough for unit-level tests without a real DB.
 */
function createMockPool(responses: QueryResultRow[][]) {
  let cursor = 0;
  const queries: { sql: string; params: readonly unknown[] }[] = [];

  const query = vi.fn((sql: string, params?: readonly unknown[]) => {
    queries.push({ sql, params: params ?? [] });
    const rows = responses[cursor] ?? [];
    cursor++;
    return Promise.resolve({ rows });
  });

  return {
    pool: { query } as unknown as Pool,
    queries,
    reset: () => {
      cursor = 0;
      queries.length = 0;
    },
  };
}

describe('CollaborationService', () => {
  const subjectUri = 'at://did:plc:owner/pub.chive.graph.node/c1' as AtUri;
  const inviterDid = 'did:plc:owner' as DID;
  const inviteeDid = 'did:plc:alice' as DID;
  const inviteUri = 'at://did:plc:owner/pub.chive.collaboration.invite/i1' as AtUri;
  const acceptanceUri = 'at://did:plc:alice/pub.chive.collaboration.inviteAcceptance/a1' as AtUri;

  let logger: ILogger;
  beforeEach(() => {
    logger = createMockLogger();
  });

  describe('indexInvite', () => {
    it('inserts the invite row and re-evaluates pending state', async () => {
      const mock = createMockPool([[], [], []]);
      const service = new CollaborationService({ pool: mock.pool, logger });

      const result = await service.indexInvite(
        {
          subject: { uri: subjectUri },
          invitee: inviteeDid,
          role: 'collaborator',
          createdAt: '2026-04-11T00:00:00Z',
        },
        {
          uri: inviteUri,
          cid: 'bafyrei' as CID,
          pdsUrl: 'https://pds.example',
          indexedAt: new Date(),
        }
      );

      expect(isOk(result)).toBe(true);
      expect(mock.queries[0]?.sql).toContain('INSERT INTO collaboration_invites_index');
      // Next two queries select invite + acceptance for pair reevaluation
      expect(mock.queries[1]?.sql).toContain('FROM collaboration_invites_index');
      expect(mock.queries[2]?.sql).toContain('FROM collaboration_acceptances_index');
    });

    it('extracts the inviter DID from the invite URI authority', async () => {
      const mock = createMockPool([[], [], [], []]);
      const service = new CollaborationService({ pool: mock.pool, logger });

      await service.indexInvite(
        {
          subject: { uri: subjectUri },
          invitee: inviteeDid,
          createdAt: '2026-04-11T00:00:00Z',
        },
        {
          uri: inviteUri,
          cid: 'bafyrei' as CID,
          pdsUrl: 'https://pds.example',
          indexedAt: new Date(),
        }
      );

      const insertParams = mock.queries[0]?.params ?? [];
      // params order: uri, cid, inviter_did, invitee_did, subject_uri, ...
      expect(insertParams[2]).toBe(inviterDid);
      expect(insertParams[3]).toBe(inviteeDid);
      expect(insertParams[4]).toBe(subjectUri);
    });
  });

  describe('isCollaborator', () => {
    it('returns true when invite and acceptance both exist and are not deleted', async () => {
      const mock = createMockPool([[{ one: 1 }]]);
      const service = new CollaborationService({ pool: mock.pool, logger });

      const result = await service.isCollaborator(subjectUri, inviteeDid);
      expect(result).toBe(true);
    });

    it('returns false when no matching row is found', async () => {
      const mock = createMockPool([[]]);
      const service = new CollaborationService({ pool: mock.pool, logger });
      const result = await service.isCollaborator(subjectUri, inviteeDid);
      expect(result).toBe(false);
    });
  });

  describe('getActiveCollaborators', () => {
    it('maps rows into ActiveCollaborator records', async () => {
      const now = new Date('2026-04-11T00:00:00Z');
      const mock = createMockPool([
        [
          {
            did: inviteeDid,
            invite_uri: inviteUri,
            acceptance_uri: acceptanceUri,
            role: 'collaborator',
            accepted_at: now,
          },
        ],
      ]);
      const service = new CollaborationService({ pool: mock.pool, logger });
      const collaborators = await service.getActiveCollaborators(subjectUri);
      expect(collaborators).toHaveLength(1);
      expect(collaborators[0]?.did).toBe(inviteeDid);
      expect(collaborators[0]?.role).toBe('collaborator');
      expect(collaborators[0]?.inviteUri).toBe(inviteUri);
      expect(collaborators[0]?.acceptanceUri).toBe(acceptanceUri);
      expect(collaborators[0]?.acceptedAt).toEqual(now);
    });
  });

  describe('deleteInvite', () => {
    it('marks the invite row as deleted and re-evaluates pair', async () => {
      const mock = createMockPool([[{ subject_uri: subjectUri, invitee_did: inviteeDid }], [], []]);
      const service = new CollaborationService({ pool: mock.pool, logger });
      const result = await service.deleteInvite(inviteUri);
      expect(isOk(result)).toBe(true);
      expect(mock.queries[0]?.sql).toContain('UPDATE collaboration_invites_index');
      expect(mock.queries[0]?.sql).toContain('SET deleted_at = NOW()');
    });
  });

  describe('out-of-order delivery', () => {
    it('indexing acceptance before invite still records acceptance', async () => {
      // Acceptance arrives first. pair-reevaluation runs against current
      // state: no invite, acceptance present → pending-invite.
      const mock = createMockPool([
        [], // INSERT acceptance
        [], // SELECT invite (none yet)
        [], // SELECT acceptance (redundant)
        [], // INSERT pending_state
      ]);
      const service = new CollaborationService({ pool: mock.pool, logger });
      const result = await service.indexAcceptance(
        {
          invite: { uri: inviteUri },
          subject: { uri: subjectUri },
          createdAt: '2026-04-11T00:00:00Z',
        },
        {
          uri: acceptanceUri,
          cid: 'bafyrei' as CID,
          pdsUrl: 'https://pds.example',
          indexedAt: new Date(),
        }
      );
      expect(isOk(result)).toBe(true);
      expect(mock.queries[0]?.sql).toContain('INSERT INTO collaboration_acceptances_index');
    });
  });
});
