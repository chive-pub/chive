import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GovernancePDSWriter } from '../../../../src/services/governance/governance-pds-writer.js';
import type { DID, NSID } from '../../../../src/types/atproto.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';

const { mockLogin, mockCreateRecord, sessionRef } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockCreateRecord: vi.fn(),
  sessionRef: { value: undefined as unknown },
}));

vi.mock('@atproto/api', () => ({
  AtpAgent: class {
    service: string;
    com = { atproto: { repo: { createRecord: mockCreateRecord } } };

    constructor(options: { service: string }) {
      this.service = options.service;
    }

    get session() {
      return sessionRef.value;
    }

    async login(credentials: { identifier: string; password: string }) {
      await mockLogin(credentials);
      sessionRef.value = { did: 'did:plc:governance' };
    }
  },
}));

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const GRAPH_PDS_DID = 'did:plc:governance' as DID;
const COLLECTION = 'pub.chive.graph.authorityRecord' as NSID;

function build() {
  return new GovernancePDSWriter({
    graphPdsDid: GRAPH_PDS_DID,
    pdsUrl: 'https://governance.test',
    handle: 'chive-governance.test',
    password: 'test-password',
    pool: {} as unknown as Pool,
    cache: {} as unknown as Redis,
    logger: createMockLogger(),
  });
}

describe('GovernancePDSWriter authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionRef.value = undefined;
    mockCreateRecord.mockResolvedValue({ data: { cid: 'bafyrecord' } });
  });

  it('does not touch the PDS until something is written', () => {
    build();

    // A governance PDS that is briefly down at boot must not take the process
    // with it, and most requests never write to the repository at all.
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('logs in with the governance account before writing', async () => {
    const writer = build();

    await writer.createProposalBootstrap(COLLECTION, 'rkey1', { label: 'Linguistics' });

    expect(mockLogin).toHaveBeenCalledWith({
      identifier: 'chive-governance.test',
      password: 'test-password',
    });
    expect(mockCreateRecord).toHaveBeenCalledWith(
      expect.objectContaining({ repo: GRAPH_PDS_DID, collection: COLLECTION, rkey: 'rkey1' })
    );
  });

  it('writes authenticated, so the record is actually accepted', async () => {
    // The old writer built an unauthenticated agent and ignored the signing key
    // it was handed, so every write would have been rejected had one been made.
    const writer = build();

    const result = await writer.createProposalBootstrap(COLLECTION, 'rkey1', { label: 'x' });

    expect(result.ok).toBe(true);
    expect(mockLogin).toHaveBeenCalledOnce();
  });

  it('reuses one session across writes', async () => {
    const writer = build();

    await writer.createProposalBootstrap(COLLECTION, 'rkey1', { label: 'a' });
    await writer.createProposalBootstrap(COLLECTION, 'rkey2', { label: 'b' });

    expect(mockLogin).toHaveBeenCalledOnce();
    expect(mockCreateRecord).toHaveBeenCalledTimes(2);
  });

  it('shares one login attempt between concurrent writes', async () => {
    const writer = build();

    await Promise.all([
      writer.createProposalBootstrap(COLLECTION, 'rkey1', { label: 'a' }),
      writer.createProposalBootstrap(COLLECTION, 'rkey2', { label: 'b' }),
    ]);

    expect(mockLogin).toHaveBeenCalledOnce();
  });

  it('reports a failed login as a write failure rather than throwing', async () => {
    mockLogin.mockRejectedValueOnce(new Error('invalid password'));
    const writer = build();

    const result = await writer.createProposalBootstrap(COLLECTION, 'rkey1', { label: 'x' });

    expect(result.ok).toBe(false);
  });

  it('retries the login on the next write instead of failing forever', async () => {
    mockLogin.mockRejectedValueOnce(new Error('PDS unreachable'));
    const writer = build();

    const first = await writer.createProposalBootstrap(COLLECTION, 'rkey1', { label: 'x' });
    const second = await writer.createProposalBootstrap(COLLECTION, 'rkey2', { label: 'y' });

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(true);
    expect(mockLogin).toHaveBeenCalledTimes(2);
  });
});
