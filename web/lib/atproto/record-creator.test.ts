/**
 * Tests for ATProto record creation utilities.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi } from 'vitest';
import type { Agent } from '@atproto/api';

import { TEST_GRAPH_PDS_DID } from '@/tests/test-constants';

import {
  uploadBlob,
  uploadDocument,
  createEprintRecord,
  createFieldProposalRecord,
  createVoteRecord,
  deleteRecord,
  updateEndorsementRecord,
  updateReviewRecord,
  updateChiveProfileRecord,
  isAgentAuthenticated,
  getAuthenticatedDid,
  buildAtUri,
  parseAtUri,
  createStandardDocument,
  describesEprint,
  createLayersDataLinks,
  updateStandardDocument,
  deleteStandardDocumentsForEprint,
} from './record-creator';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * Create a mock Agent for testing.
 */
function createMockAgent(options: { authenticated?: boolean; did?: string } = {}) {
  const { authenticated = true, did = 'did:plc:test123' } = options;

  const mockAgent = {
    did: authenticated ? did : undefined,
    uploadBlob: vi.fn().mockResolvedValue({
      success: true,
      data: {
        blob: { ref: { $link: 'bafytest' }, mimeType: 'application/pdf', size: 1024 },
      },
    }),
    com: {
      atproto: {
        repo: {
          createRecord: vi.fn().mockImplementation(async (params: { collection: string }) => ({
            success: true,
            data: {
              uri: `at://${did}/${params.collection}/abc123`,
              cid: 'bafyrecord123',
            },
          })),
          deleteRecord: vi.fn().mockResolvedValue({ success: true }),
          putRecord: vi
            .fn()
            .mockImplementation(async (params: { collection: string; rkey: string }) => ({
              data: {
                uri: `at://${did}/${params.collection}/${params.rkey}`,
                cid: 'bafyupdated123',
              },
            })),
          getRecord: vi
            .fn()
            .mockImplementation(async (params: { collection: string; rkey: string }) => ({
              data: {
                uri: `at://${did}/${params.collection}/${params.rkey}`,
                cid: 'bafyexisting123',
                value: {
                  $type: params.collection,
                  eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/paper123',
                  contributions: ['writing'],
                  createdAt: '2024-01-15T00:00:00.000Z',
                },
              },
            })),
        },
      },
    },
  } as unknown as Agent;

  return mockAgent;
}

/**
 * Create a mock File for testing with arrayBuffer support.
 */
function createMockFile(name: string, type: string, size: number = 1024): File {
  const content = new ArrayBuffer(size);
  const file = new File([content], name, { type });

  // Polyfill arrayBuffer for jsdom
  if (!file.arrayBuffer) {
    (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
      content;
  }

  return file;
}

/**
 * Create a complete author reference for testing.
 */
function createTestAuthor(
  overrides: Partial<{
    did: string;
    order: number;
    name: string;
    affiliations: { name: string; rorId?: string; children?: Array<{ name: string }> }[];
    contributions: {
      typeUri: string;
      typeId?: string;
      typeLabel?: string;
      degree: 'lead' | 'equal' | 'supporting';
    }[];
    isCorrespondingAuthor: boolean;
    isHighlighted: boolean;
  }> = {}
) {
  return {
    did: 'did:plc:author1',
    order: 1,
    name: 'Test Author',
    affiliations: [],
    contributions: [],
    isCorrespondingAuthor: false,
    isHighlighted: false,
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('uploadBlob', () => {
  it('uploads a file and returns blob reference', async () => {
    const agent = createMockAgent();
    const file = createMockFile('test.pdf', 'application/pdf');

    const result = await uploadBlob(agent, file);

    expect(result.blobRef).toBeDefined();
    expect(result.size).toBe(file.size);
    expect(result.mimeType).toBe('application/pdf');
    expect(agent.uploadBlob).toHaveBeenCalled();
  });

  it('throws error when agent is not authenticated', async () => {
    const agent = createMockAgent({ authenticated: false });
    const file = createMockFile('test.pdf', 'application/pdf');

    await expect(uploadBlob(agent, file)).rejects.toThrow('Agent is not authenticated');
  });
});

describe('uploadDocument', () => {
  it('uploads a PDF file', async () => {
    const agent = createMockAgent();
    const file = createMockFile('paper.pdf', 'application/pdf');

    const result = await uploadDocument(agent, file);

    expect(result.blobRef).toBeDefined();
    expect(result.mimeType).toBe('application/pdf');
  });

  it('uploads a DOCX file', async () => {
    const agent = createMockAgent();
    const file = createMockFile(
      'paper.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    const result = await uploadDocument(agent, file);

    expect(result.blobRef).toBeDefined();
  });

  it('uploads a Markdown file', async () => {
    const agent = createMockAgent();
    const file = createMockFile('paper.md', 'text/markdown');

    const result = await uploadDocument(agent, file);

    expect(result.blobRef).toBeDefined();
  });
});

describe('createEprintRecord', () => {
  it('creates an eprint record in user PDS', async () => {
    const agent = createMockAgent();
    const documentFile = createMockFile('paper.pdf', 'application/pdf');

    const result = await createEprintRecord(agent, {
      documentFile,
      title: 'Test Paper',
      abstract: 'This is a test abstract that is long enough to pass validation.',
      authors: [createTestAuthor()],
      fieldNodes: [
        {
          uri: `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71`,
        },
      ],
      licenseSlug: 'CC-BY-4.0',
    });

    expect(result.uri).toContain('pub.chive.eprint.submission');
    expect(result.cid).toBeDefined();
    expect(agent.com.atproto.repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'pub.chive.eprint.submission',
      })
    );
  });

  it('includes optional fields when provided', async () => {
    const agent = createMockAgent();
    const documentFile = createMockFile('paper.pdf', 'application/pdf');

    await createEprintRecord(agent, {
      documentFile,
      title: 'Test Paper',
      abstract: 'This is a test abstract that is long enough to pass validation.',
      authors: [createTestAuthor()],
      fieldNodes: [
        {
          uri: `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71`,
        },
      ],
      keywords: ['machine learning', 'ai'],
      licenseSlug: 'CC-BY-4.0',
    });

    const createRecordCall = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(createRecordCall.record.keywords).toEqual(['machine learning', 'ai']);
    expect(createRecordCall.record.licenseSlug).toBe('CC-BY-4.0');
  });

  it('creates an eprint record with DOCX document', async () => {
    const agent = createMockAgent();
    const documentFile = createMockFile(
      'paper.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    const result = await createEprintRecord(agent, {
      documentFile,
      documentFormat: 'docx',
      title: 'Test Paper',
      abstract: 'This is a test abstract that is long enough to pass validation.',
      authors: [createTestAuthor()],
      fieldNodes: [
        {
          uri: `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71`,
        },
      ],
      licenseSlug: 'CC-BY-4.0',
    });

    expect(result.uri).toContain('pub.chive.eprint.submission');
    expect(result.cid).toBeDefined();
  });

  it('throws error when not authenticated', async () => {
    const agent = createMockAgent({ authenticated: false });
    const documentFile = createMockFile('paper.pdf', 'application/pdf');

    await expect(
      createEprintRecord(agent, {
        documentFile,
        title: 'Test',
        abstract: 'This is a test abstract that is long enough to pass validation.',
        authors: [createTestAuthor()],
        fieldNodes: [
          {
            uri: `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71`,
          },
        ],
        licenseSlug: 'CC-BY-4.0',
      })
    ).rejects.toThrow('User agent is not authenticated');
  });
});

describe('createFieldProposalRecord', () => {
  it('creates a field proposal record', async () => {
    const agent = createMockAgent();

    const result = await createFieldProposalRecord(agent, {
      proposalType: 'create',
      fieldName: 'Quantum Machine Learning',
      description: 'A field combining quantum computing and machine learning approaches.',
    });

    expect(result.uri).toContain('pub.chive.graph.fieldProposal');
    expect(agent.com.atproto.repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'pub.chive.graph.fieldProposal',
      })
    );
  });

  it('includes external mappings when provided', async () => {
    const agent = createMockAgent();

    await createFieldProposalRecord(agent, {
      proposalType: 'create',
      fieldName: 'Test Field',
      description: 'A test field description that is long enough.',
      externalMappings: [{ source: 'wikidata', id: 'Q12345' }],
    });

    const createRecordCall = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(createRecordCall.record.externalMappings).toEqual([
      { source: 'wikidata', id: 'Q12345' },
    ]);
  });
});

describe('createVoteRecord', () => {
  it('creates a vote record', async () => {
    const agent = createMockAgent();

    const result = await createVoteRecord(agent, {
      proposalUri: 'at://did:plc:user/pub.chive.graph.fieldProposal/123',
      vote: 'approve',
      rationale: 'This is a well-defined field.',
    });

    expect(result.uri).toBeDefined();
    expect(agent.com.atproto.repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'pub.chive.graph.vote',
      })
    );
  });

  // VoteRecord carries an index signature, so a misnamed wire field typechecks
  // silently; only an assertion on the emitted record catches the regression.
  it('writes the rationale to the lexicon comment field', async () => {
    const agent = createMockAgent();

    await createVoteRecord(agent, {
      proposalUri: 'at://did:plc:user/pub.chive.graph.fieldProposal/123',
      vote: 'approve',
      rationale: 'This is a well-defined field.',
    });

    const createRecordCall = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(createRecordCall.record.comment).toBe('This is a well-defined field.');
    expect(createRecordCall.record.rationale).toBeUndefined();
  });

  it('omits the comment field when no rationale is given', async () => {
    const agent = createMockAgent();

    await createVoteRecord(agent, {
      proposalUri: 'at://did:plc:user/pub.chive.graph.fieldProposal/123',
      vote: 'reject',
    });

    const createRecordCall = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(createRecordCall.record).not.toHaveProperty('comment');
  });
});

describe('deleteRecord', () => {
  it('deletes a record belonging to the user', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });
    const uri = `at://${did}/pub.chive.eprint.submission/abc123`;

    await deleteRecord(agent, uri);

    expect(agent.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
      repo: did,
      collection: 'pub.chive.eprint.submission',
      rkey: 'abc123',
    });
  });

  it('throws error for invalid AT-URI', async () => {
    const agent = createMockAgent();

    await expect(deleteRecord(agent, 'invalid-uri')).rejects.toThrow('Invalid AT-URI format');
  });

  it('throws error when trying to delete another user record', async () => {
    const agent = createMockAgent({ did: 'did:plc:user1' });
    const uri = 'at://did:plc:user2/pub.chive.eprint.submission/abc123';

    await expect(deleteRecord(agent, uri)).rejects.toThrow(
      'Cannot delete records belonging to other users'
    );
  });
});

describe('deleteStandardDocumentsForEprint', () => {
  const did = 'did:plc:test123';
  const eprintUri = `at://${did}/pub.chive.eprint.submission/paper123`;

  /**
   * Build a mock agent whose listRecords returns the supplied pages of
   * site.standard.document records.
   */
  function createListingAgent(pages: Array<{ records: unknown[]; cursor?: string }>) {
    const agent = createMockAgent({ did });
    const listRecords = vi.fn();
    pages.forEach((page) => {
      listRecords.mockResolvedValueOnce({ data: { records: page.records, cursor: page.cursor } });
    });
    (agent.com.atproto.repo as unknown as { listRecords: typeof listRecords }).listRecords =
      listRecords;
    return { agent, listRecords };
  }

  it('deletes only the documents pointing at the eprint', async () => {
    const { agent } = createListingAgent([
      {
        records: [
          {
            uri: `at://${did}/site.standard.document/match1`,
            value: { content: { uri: eprintUri } },
          },
          {
            uri: `at://${did}/site.standard.document/other`,
            value: { content: { uri: `at://${did}/pub.chive.eprint.submission/different` } },
          },
        ],
      },
    ]);

    const deleted = await deleteStandardDocumentsForEprint(agent, eprintUri);

    expect(deleted).toEqual([`at://${did}/site.standard.document/match1`]);
    expect(agent.com.atproto.repo.deleteRecord).toHaveBeenCalledTimes(1);
    expect(agent.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
      repo: did,
      collection: 'site.standard.document',
      rkey: 'match1',
    });
  });

  it('pages through the collection until the cursor is exhausted', async () => {
    const { agent, listRecords } = createListingAgent([
      {
        records: [
          {
            uri: `at://${did}/site.standard.document/match1`,
            value: { content: { uri: eprintUri } },
          },
        ],
        cursor: 'page2',
      },
      {
        records: [
          {
            uri: `at://${did}/site.standard.document/match2`,
            value: { content: { uri: eprintUri } },
          },
        ],
      },
    ]);

    const deleted = await deleteStandardDocumentsForEprint(agent, eprintUri);

    expect(deleted).toHaveLength(2);
    expect(listRecords).toHaveBeenCalledTimes(2);
    expect(listRecords.mock.calls[1][0]).toMatchObject({ cursor: 'page2' });
  });

  it('returns an empty array when no documents match', async () => {
    const { agent } = createListingAgent([{ records: [] }]);

    const deleted = await deleteStandardDocumentsForEprint(agent, eprintUri);

    expect(deleted).toEqual([]);
    expect(agent.com.atproto.repo.deleteRecord).not.toHaveBeenCalled();
  });

  it('throws when the agent is not authenticated', async () => {
    const agent = createMockAgent({ authenticated: false });

    await expect(deleteStandardDocumentsForEprint(agent, eprintUri)).rejects.toThrow(
      'Agent is not authenticated'
    );
  });
});

describe('isAgentAuthenticated', () => {
  it('returns true for authenticated agent', () => {
    const agent = createMockAgent({ authenticated: true });
    expect(isAgentAuthenticated(agent)).toBe(true);
  });

  it('returns false for unauthenticated agent', () => {
    const agent = createMockAgent({ authenticated: false });
    expect(isAgentAuthenticated(agent)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAgentAuthenticated(null)).toBe(false);
  });
});

describe('getAuthenticatedDid', () => {
  it('returns DID for authenticated agent', () => {
    const agent = createMockAgent({ did: 'did:plc:test123' });
    expect(getAuthenticatedDid(agent)).toBe('did:plc:test123');
  });

  it('throws error for unauthenticated agent', () => {
    const agent = createMockAgent({ authenticated: false });
    expect(() => getAuthenticatedDid(agent)).toThrow('Agent is not authenticated');
  });
});

describe('buildAtUri', () => {
  it('builds correct AT-URI', () => {
    const uri = buildAtUri('did:plc:abc', 'pub.chive.eprint.submission', '123');
    expect(uri).toBe('at://did:plc:abc/pub.chive.eprint.submission/123');
  });
});

describe('parseAtUri', () => {
  it('parses valid AT-URI', () => {
    const result = parseAtUri('at://did:plc:abc/pub.chive.eprint.submission/123');
    expect(result).toEqual({
      did: 'did:plc:abc',
      collection: 'pub.chive.eprint.submission',
      rkey: '123',
    });
  });

  it('returns null for invalid URI', () => {
    expect(parseAtUri('invalid-uri')).toBeNull();
    expect(parseAtUri('https://example.com')).toBeNull();
  });
});

describe('updateEndorsementRecord', () => {
  it('fetches existing record before updating', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });
    const uri = `at://${did}/pub.chive.review.endorsement/endorsement123`;

    await updateEndorsementRecord(agent, {
      uri,
      contributions: ['conceptualization', 'writing'],
    });

    expect(agent.com.atproto.repo.getRecord).toHaveBeenCalledWith({
      repo: did,
      collection: 'pub.chive.review.endorsement',
      rkey: 'endorsement123',
    });
  });

  it('uses putRecord to update the record', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });
    const uri = `at://${did}/pub.chive.review.endorsement/endorsement123`;

    const result = await updateEndorsementRecord(agent, {
      uri,
      contributions: ['methodology'],
    });

    expect(agent.com.atproto.repo.putRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: did,
        collection: 'pub.chive.review.endorsement',
        rkey: 'endorsement123',
      })
    );
    expect(result.uri).toContain('pub.chive.review.endorsement');
    expect(result.cid).toBeDefined();
  });

  it('preserves original eprintUri and createdAt', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });
    const uri = `at://${did}/pub.chive.review.endorsement/endorsement123`;

    await updateEndorsementRecord(agent, {
      uri,
      contributions: ['validation'],
    });

    const putRecordCall = (agent.com.atproto.repo.putRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];

    // Should preserve the eprintUri and createdAt from the existing record
    expect(putRecordCall.record.eprintUri).toBe(
      'at://did:plc:author/pub.chive.eprint.submission/paper123'
    );
    expect(putRecordCall.record.createdAt).toBe('2024-01-15T00:00:00.000Z');
  });

  it('throws when updating another user record', async () => {
    const agent = createMockAgent({ did: 'did:plc:user1' });
    const uri = 'at://did:plc:user2/pub.chive.review.endorsement/abc123';

    await expect(
      updateEndorsementRecord(agent, {
        uri,
        contributions: ['writing'],
      })
    ).rejects.toThrow('Cannot update records belonging to other users');
  });

  it('throws when not authenticated', async () => {
    const agent = createMockAgent({ authenticated: false });
    const uri = 'at://did:plc:test123/pub.chive.review.endorsement/abc123';

    await expect(
      updateEndorsementRecord(agent, {
        uri,
        contributions: ['writing'],
      })
    ).rejects.toThrow('Agent is not authenticated');
  });

  it('includes optional comment when provided', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });
    const uri = `at://${did}/pub.chive.review.endorsement/endorsement123`;

    await updateEndorsementRecord(agent, {
      uri,
      contributions: ['writing'],
      comment: 'Updated comment',
    });

    const putRecordCall = (agent.com.atproto.repo.putRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(putRecordCall.record.comment).toBe('Updated comment');
  });
});

describe('updateReviewRecord', () => {
  it('fetches existing record before updating', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    // Mock getRecord to return a review comment
    (agent.com.atproto.repo.getRecord as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        uri: `at://${did}/pub.chive.review.comment/review123`,
        cid: 'bafyexisting123',
        value: {
          $type: 'pub.chive.review.comment',
          eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/paper123',
          content: 'Original content',
          createdAt: '2024-01-15T00:00:00.000Z',
        },
      },
    });

    const uri = `at://${did}/pub.chive.review.comment/review123`;

    await updateReviewRecord(agent, {
      uri,
      content: 'Updated content',
    });

    expect(agent.com.atproto.repo.getRecord).toHaveBeenCalledWith({
      repo: did,
      collection: 'pub.chive.review.comment',
      rkey: 'review123',
    });
  });

  it('uses putRecord to update the record', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    // Mock getRecord to return a review comment
    (agent.com.atproto.repo.getRecord as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        uri: `at://${did}/pub.chive.review.comment/review123`,
        cid: 'bafyexisting123',
        value: {
          $type: 'pub.chive.review.comment',
          eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/paper123',
          content: 'Original content',
          createdAt: '2024-01-15T00:00:00.000Z',
        },
      },
    });

    const uri = `at://${did}/pub.chive.review.comment/review123`;

    const result = await updateReviewRecord(agent, {
      uri,
      content: 'Updated content',
    });

    expect(agent.com.atproto.repo.putRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: did,
        collection: 'pub.chive.review.comment',
        rkey: 'review123',
      })
    );
    expect(result.uri).toContain('pub.chive.review.comment');
    expect(result.cid).toBeDefined();
  });

  it('preserves original eprintUri and createdAt', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    // Mock getRecord to return a review comment
    (agent.com.atproto.repo.getRecord as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        uri: `at://${did}/pub.chive.review.comment/review123`,
        cid: 'bafyexisting123',
        value: {
          $type: 'pub.chive.review.comment',
          eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/paper123',
          content: 'Original content',
          createdAt: '2024-01-15T00:00:00.000Z',
        },
      },
    });

    const uri = `at://${did}/pub.chive.review.comment/review123`;

    await updateReviewRecord(agent, {
      uri,
      content: 'Updated content',
    });

    const putRecordCall = (agent.com.atproto.repo.putRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];

    // Should preserve the eprintUri and createdAt from the existing record
    expect(putRecordCall.record.eprintUri).toBe(
      'at://did:plc:author/pub.chive.eprint.submission/paper123'
    );
    expect(putRecordCall.record.createdAt).toBe('2024-01-15T00:00:00.000Z');
    // Content is now stored in the body array
    expect(putRecordCall.record.body[0].content).toBe('Updated content');
  });

  it('preserves parentComment when present', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    // Mock getRecord to return a reply
    (agent.com.atproto.repo.getRecord as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        uri: `at://${did}/pub.chive.review.comment/review123`,
        cid: 'bafyexisting123',
        value: {
          $type: 'pub.chive.review.comment',
          eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/paper123',
          content: 'Original reply',
          parentComment: 'at://did:plc:other/pub.chive.review.comment/parent123',
          createdAt: '2024-01-15T00:00:00.000Z',
        },
      },
    });

    const uri = `at://${did}/pub.chive.review.comment/review123`;

    await updateReviewRecord(agent, {
      uri,
      content: 'Updated reply',
    });

    const putRecordCall = (agent.com.atproto.repo.putRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];

    expect(putRecordCall.record.parentComment).toBe(
      'at://did:plc:other/pub.chive.review.comment/parent123'
    );
  });

  it('throws when updating another user record', async () => {
    const agent = createMockAgent({ did: 'did:plc:user1' });
    const uri = 'at://did:plc:user2/pub.chive.review.comment/abc123';

    await expect(
      updateReviewRecord(agent, {
        uri,
        content: 'Updated content',
      })
    ).rejects.toThrow('Cannot update records belonging to other users');
  });

  it('throws when not authenticated', async () => {
    const agent = createMockAgent({ authenticated: false });
    const uri = 'at://did:plc:test123/pub.chive.review.comment/abc123';

    await expect(
      updateReviewRecord(agent, {
        uri,
        content: 'Updated content',
      })
    ).rejects.toThrow('Agent is not authenticated');
  });
});

describe('updateChiveProfileRecord', () => {
  it('uses putRecord with self rkey', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    await updateChiveProfileRecord(agent, {
      displayName: 'Test User',
    });

    expect(agent.com.atproto.repo.putRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: did,
        collection: 'pub.chive.actor.profile',
        rkey: 'self',
      })
    );
  });

  it('only includes non-null fields in record', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    await updateChiveProfileRecord(agent, {
      displayName: 'Test User',
      bio: 'My bio',
      // Not providing orcid, affiliations, etc.
    });

    const putRecordCall = (agent.com.atproto.repo.putRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];

    expect(putRecordCall.record.$type).toBe('pub.chive.actor.profile');
    expect(putRecordCall.record.displayName).toBe('Test User');
    expect(putRecordCall.record.bio).toBe('My bio');
    expect(putRecordCall.record.orcid).toBeUndefined();
    expect(putRecordCall.record.affiliations).toBeUndefined();
  });

  it('includes orcid when provided', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    await updateChiveProfileRecord(agent, {
      orcid: '0000-0001-2345-6789',
    });

    const putRecordCall = (agent.com.atproto.repo.putRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(putRecordCall.record.orcid).toBe('0000-0001-2345-6789');
  });

  it('includes affiliations array when provided', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    await updateChiveProfileRecord(agent, {
      affiliations: [{ name: 'MIT', rorId: 'https://ror.org/042nb2s44' }, { name: 'Stanford' }],
    });

    const putRecordCall = (agent.com.atproto.repo.putRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(putRecordCall.record.affiliations).toHaveLength(2);
    expect(putRecordCall.record.affiliations[0].name).toBe('MIT');
  });

  it('throws when not authenticated', async () => {
    const agent = createMockAgent({ authenticated: false });

    await expect(
      updateChiveProfileRecord(agent, {
        displayName: 'Test',
      })
    ).rejects.toThrow('Agent is not authenticated');
  });

  it('returns correct uri and cid', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    const result = await updateChiveProfileRecord(agent, {
      displayName: 'Test User',
    });

    expect(result.uri).toBe(`at://${did}/pub.chive.actor.profile/self`);
    expect(result.cid).toBe('bafyupdated123');
  });
});

// =============================================================================
// STANDARD.SITE DOCUMENT TESTS
// =============================================================================

describe('createStandardDocument', () => {
  it('creates a standard.site document record', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    const result = await createStandardDocument(agent, {
      title: 'Test Paper',
      description: 'This is a test abstract.',
      eprintUri: `at://${did}/pub.chive.eprint.submission/abc123`,
      eprintCid: 'bafyeprint123',
    });

    expect(result.uri).toContain('site.standard.document');
    expect(result.cid).toBeDefined();
    expect(agent.com.atproto.repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: did,
        collection: 'site.standard.document',
      })
    );
  });

  // Five tests here asserted the invalid shape: `content: {uri, cid}`,
  // `visibility`, `createdAt`, and a 2000-character description cap. None of
  // those are properties of `site.standard.document`. They are replaced by the
  // conformance block at the end of this file, which checks the record against
  // the published lexicon instead.

  it('truncates a description to the length the lexicon allows', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    await createStandardDocument(agent, {
      title: 'Test Paper',
      description: 'x'.repeat(40000),
      eprintUri: `at://${did}/pub.chive.eprint.submission/abc123`,
    });

    const createRecordCall = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    // 30000, not 2000: the lexicon's maxLength.
    expect(createRecordCall.record.description).toHaveLength(30000);
  });

  it('throws when not authenticated', async () => {
    const agent = createMockAgent({ authenticated: false });

    await expect(
      createStandardDocument(agent, {
        title: 'Test Paper',
        eprintUri: 'at://did:plc:xyz/pub.chive.eprint.submission/abc123',
      })
    ).rejects.toThrow('Agent is not authenticated');
  });
});

describe('updateStandardDocument', () => {
  it('fetches existing record before updating', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    // Mock getRecord to return a standard document
    (agent.com.atproto.repo.getRecord as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        uri: `at://${did}/site.standard.document/doc123`,
        cid: 'bafyexisting123',
        value: {
          $type: 'site.standard.document',
          title: 'Original Title',
          content: {
            uri: `at://${did}/pub.chive.eprint.submission/abc123`,
            cid: 'bafyeprint123',
          },
          visibility: 'public',
          createdAt: '2024-01-15T00:00:00.000Z',
        },
      },
    });

    const uri = `at://${did}/site.standard.document/doc123`;

    await updateStandardDocument(agent, {
      uri,
      title: 'Updated Title',
    });

    expect(agent.com.atproto.repo.getRecord).toHaveBeenCalledWith({
      repo: did,
      collection: 'site.standard.document',
      rkey: 'doc123',
    });
  });

  it('uses putRecord to update the record', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    // Mock getRecord to return a standard document
    (agent.com.atproto.repo.getRecord as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        uri: `at://${did}/site.standard.document/doc123`,
        cid: 'bafyexisting123',
        value: {
          $type: 'site.standard.document',
          title: 'Original Title',
          content: {
            uri: `at://${did}/pub.chive.eprint.submission/abc123`,
          },
          visibility: 'public',
          createdAt: '2024-01-15T00:00:00.000Z',
        },
      },
    });

    const uri = `at://${did}/site.standard.document/doc123`;

    const result = await updateStandardDocument(agent, {
      uri,
      title: 'Updated Title',
    });

    expect(agent.com.atproto.repo.putRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: did,
        collection: 'site.standard.document',
        rkey: 'doc123',
      })
    );
    expect(result.uri).toContain('site.standard.document');
    expect(result.cid).toBeDefined();
  });

  it('repairs a legacy document while updating it', async () => {
    // This used to assert `createdAt` and `visibility` survived an update.
    // Neither is a field of `site.standard.document`. A document written before
    // the schema fix has that shape and is invalid, so updating one is the
    // moment to make it valid: the required `site` and `publishedAt` are filled
    // in, and the eprint link moves from `content.uri` to `path`.
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });
    const eprintUri = `at://${did}/pub.chive.eprint.submission/abc123`;

    (agent.com.atproto.repo.getRecord as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        uri: `at://${did}/site.standard.document/doc123`,
        cid: 'bafyexisting123',
        value: {
          $type: 'site.standard.document',
          title: 'Original Title',
          content: { uri: eprintUri },
          visibility: 'public',
          createdAt: '2024-01-15T00:00:00.000Z',
        },
      },
    });

    await updateStandardDocument(agent, {
      uri: `at://${did}/site.standard.document/doc123`,
      title: 'Updated Title',
    });

    const record = (agent.com.atproto.repo.putRecord as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .record;
    expect(record.site).toEqual(expect.any(String));
    expect(record.publishedAt).toEqual(expect.any(String));
    expect(record.path).toBe(`/eprints/${encodeURIComponent(eprintUri)}`);
    expect(record).not.toHaveProperty('visibility');
    expect(record).not.toHaveProperty('createdAt');
  });

  it('adds updatedAt timestamp', async () => {
    const did = 'did:plc:test123';
    const agent = createMockAgent({ did });

    // Mock getRecord
    (agent.com.atproto.repo.getRecord as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        uri: `at://${did}/site.standard.document/doc123`,
        cid: 'bafyexisting123',
        value: {
          $type: 'site.standard.document',
          title: 'Original Title',
          content: { uri: `at://${did}/pub.chive.eprint.submission/abc123` },
          visibility: 'public',
          createdAt: '2024-01-15T00:00:00.000Z',
        },
      },
    });

    await updateStandardDocument(agent, {
      uri: `at://${did}/site.standard.document/doc123`,
      title: 'Updated Title',
    });

    const putRecordCall = (agent.com.atproto.repo.putRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(putRecordCall.record.updatedAt).toBeDefined();
  });

  it('throws when updating another user record', async () => {
    const agent = createMockAgent({ did: 'did:plc:user1' });
    const uri = 'at://did:plc:user2/site.standard.document/doc123';

    await expect(
      updateStandardDocument(agent, {
        uri,
        title: 'Updated Title',
      })
    ).rejects.toThrow('Cannot update records belonging to other users');
  });

  it('throws when not authenticated', async () => {
    const agent = createMockAgent({ authenticated: false });

    await expect(
      updateStandardDocument(agent, {
        uri: 'at://did:plc:test123/site.standard.document/doc123',
        title: 'Updated Title',
      })
    ).rejects.toThrow('Agent is not authenticated');
  });
});

// =============================================================================
// LAYERS DATA LINK TESTS
// =============================================================================

describe('createLayersDataLinks', () => {
  const did = 'did:plc:test123';
  const eprintUri = `at://${did}/pub.chive.eprint.submission/abc123`;

  it('writes one dataLink record per dataset', async () => {
    const agent = createMockAgent({ did });

    const result = await createLayersDataLinks(agent, {
      eprintUri,
      dataLinks: [{ dataKind: 'corpus' }, { dataKind: 'annotation-layer' }],
    });

    expect(result.created).toHaveLength(2);
    expect(result.failed).toEqual([]);
    expect(agent.com.atproto.repo.createRecord).toHaveBeenCalledTimes(2);
  });

  it('writes into the Layers collection, not a Chive one', async () => {
    const agent = createMockAgent({ did });

    await createLayersDataLinks(agent, { eprintUri, dataLinks: [{ dataKind: 'corpus' }] });

    expect(agent.com.atproto.repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ repo: did, collection: 'pub.layers.eprint.dataLink' })
    );
  });

  it('carries the eprint URI, kind and timestamp the lexicon requires', async () => {
    const agent = createMockAgent({ did });

    await createLayersDataLinks(agent, { eprintUri, dataLinks: [{ dataKind: 'corpus' }] });

    const { record } = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(record.$type).toBe('pub.layers.eprint.dataLink');
    expect(record.eprintUri).toBe(eprintUri);
    expect(record.dataKind).toBe('corpus');
    expect(record.createdAt).toEqual(expect.any(String));
  });

  it('passes through the optional fields that were given', async () => {
    const agent = createMockAgent({ did });

    await createLayersDataLinks(agent, {
      eprintUri,
      dataLinks: [
        {
          dataKind: 'corpus',
          dataKindUri: 'at://did:plc:graph/pub.chive.graph.node/corpus',
          corpusRef: 'at://did:plc:author/pub.layers.corpus/xyz',
          description: 'Sentences used in the main experiment.',
          paperSection: 'Table 3',
        },
      ],
    });

    const { record } = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(record.dataKindUri).toBe('at://did:plc:graph/pub.chive.graph.node/corpus');
    expect(record.corpusRef).toBe('at://did:plc:author/pub.layers.corpus/xyz');
    expect(record.paperSection).toBe('Table 3');
  });

  it('omits optional fields rather than writing empty ones', async () => {
    const agent = createMockAgent({ did });

    await createLayersDataLinks(agent, { eprintUri, dataLinks: [{ dataKind: 'corpus' }] });

    const { record } = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(record).not.toHaveProperty('paperSection');
    expect(record).not.toHaveProperty('corpusRef');
    expect(record).not.toHaveProperty('eprintDid');
  });

  it('reports a failed link instead of throwing, so a created eprint is never orphaned', async () => {
    const agent = createMockAgent({ did });
    (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('rate limited')
    );

    const result = await createLayersDataLinks(agent, {
      eprintUri,
      dataLinks: [{ dataKind: 'corpus' }],
    });

    expect(result.created).toEqual([]);
    expect(result.failed).toEqual([{ dataKind: 'corpus', error: 'rate limited' }]);
  });

  it('keeps writing the rest of the batch after one link fails', async () => {
    const agent = createMockAgent({ did });
    (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('rate limited')
    );

    const result = await createLayersDataLinks(agent, {
      eprintUri,
      dataLinks: [{ dataKind: 'corpus' }, { dataKind: 'model-output' }],
    });

    expect(result.failed).toHaveLength(1);
    expect(result.created).toHaveLength(1);
  });

  it('truncates a description to the length the lexicon allows', async () => {
    const agent = createMockAgent({ did });

    await createLayersDataLinks(agent, {
      eprintUri,
      dataLinks: [{ dataKind: 'corpus', description: 'x'.repeat(20000) }],
    });

    const { record } = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(record.description).toHaveLength(10000);
  });

  it('records the paper DID when the eprint lives in a paper account', async () => {
    const agent = createMockAgent({ did });

    await createLayersDataLinks(agent, {
      eprintUri,
      eprintDid: 'did:plc:paperaccount',
      dataLinks: [{ dataKind: 'corpus' }],
    });

    const { record } = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(record.eprintDid).toBe('did:plc:paperaccount');
  });

  it('writes nothing when there are no links', async () => {
    const agent = createMockAgent({ did });

    const result = await createLayersDataLinks(agent, { eprintUri, dataLinks: [] });

    expect(result).toEqual({ created: [], failed: [] });
    expect(agent.com.atproto.repo.createRecord).not.toHaveBeenCalled();
  });

  it('refuses to write for an unauthenticated agent', async () => {
    const agent = createMockAgent({ authenticated: false });

    await expect(
      createLayersDataLinks(agent, { eprintUri, dataLinks: [{ dataKind: 'corpus' }] })
    ).rejects.toThrow('not authenticated');
  });
});

// =============================================================================
// STANDARD.SITE SCHEMA CONFORMANCE
// =============================================================================

describe('createStandardDocument conforms to the published lexicon', () => {
  const did = 'did:plc:test123';
  const eprintUri = `at://${did}/pub.chive.eprint.submission/abc123`;

  function writtenRecord(agent: ReturnType<typeof createMockAgent>) {
    return (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .record as Record<string, unknown>;
  }

  it('writes the three fields the lexicon requires', async () => {
    // `site`, `title` and `publishedAt`. Two of the three were missing before,
    // so every document Chive had written was invalid and no standard.site
    // reader could accept one.
    const agent = createMockAgent({ did });

    await createStandardDocument(agent, { title: 'A paper', eprintUri });

    const record = writtenRecord(agent);
    expect(record.site).toEqual(expect.any(String));
    expect(record.title).toBe('A paper');
    expect(record.publishedAt).toEqual(expect.any(String));
  });

  it('no longer writes fields the lexicon does not define', async () => {
    // `visibility` and `createdAt` are not properties of this record type, and
    // `content` is an open union rather than a `{uri, cid}` object.
    const agent = createMockAgent({ did });

    await createStandardDocument(agent, { title: 'A paper', eprintUri });

    const record = writtenRecord(agent);
    expect(record).not.toHaveProperty('visibility');
    expect(record).not.toHaveProperty('createdAt');
    expect(record.content).toBeUndefined();
  });

  it('sets a path that resolves to the eprint page under the site origin', async () => {
    // `site` + `path` is the canonical URL, and how a reader verifies that the
    // document and the page describe the same work.
    const agent = createMockAgent({ did });

    await createStandardDocument(agent, {
      title: 'A paper',
      eprintUri,
      siteUrl: 'https://staging.chive.pub',
    });

    const record = writtenRecord(agent);
    expect(record.site).toBe('https://staging.chive.pub');
    expect(record.path).toBe(`/eprints/${encodeURIComponent(eprintUri)}`);
    expect(String(record.path).startsWith('/')).toBe(true);
  });

  it('carries contributors, tags and plaintext when given them', async () => {
    const agent = createMockAgent({ did });

    await createStandardDocument(agent, {
      title: 'A paper',
      eprintUri,
      textContent: 'The abstract in plain text.',
      tags: ['semantics', 'parsing'],
      contributors: [
        { did: 'did:plc:author1', displayName: 'A. Author', role: 'corresponding-author' },
      ],
    });

    const record = writtenRecord(agent);
    expect(record.textContent).toBe('The abstract in plain text.');
    expect(record.tags).toEqual(['semantics', 'parsing']);
    expect(record.contributors).toEqual([
      { did: 'did:plc:author1', displayName: 'A. Author', role: 'corresponding-author' },
    ]);
  });

  it('omits optional arrays rather than writing empty ones', async () => {
    const agent = createMockAgent({ did });

    await createStandardDocument(agent, {
      title: 'A paper',
      eprintUri,
      contributors: [],
      tags: [],
    });

    const record = writtenRecord(agent);
    expect(record).not.toHaveProperty('contributors');
    expect(record).not.toHaveProperty('tags');
  });

  it('defaults the site origin when none is supplied', async () => {
    const agent = createMockAgent({ did });

    await createStandardDocument(agent, { title: 'A paper', eprintUri });

    expect(writtenRecord(agent).site).toBe('https://chive.pub');
  });

  it('does not put a trailing slash on the site origin', async () => {
    // The lexicon says to avoid one, because site is concatenated with path.
    const agent = createMockAgent({ did });

    await createStandardDocument(agent, { title: 'A paper', eprintUri });

    expect(String(writtenRecord(agent).site).endsWith('/')).toBe(false);
  });
});

describe('describesEprint', () => {
  const eprintUri = 'at://did:plc:a/pub.chive.eprint.submission/abc';

  it('matches a document by its path', () => {
    expect(describesEprint({ path: `/eprints/${encodeURIComponent(eprintUri)}` }, eprintUri)).toBe(
      true
    );
  });

  it('still matches a legacy document by content.uri', () => {
    // Documents written before the schema fix carry `content.uri` and no
    // `path`. They must stay findable, or deleting an eprint strands every
    // document already in a user's repository.
    expect(describesEprint({ content: { uri: eprintUri } }, eprintUri)).toBe(true);
  });

  it('does not match a different eprint', () => {
    const other = 'at://did:plc:b/pub.chive.eprint.submission/xyz';
    expect(describesEprint({ path: `/eprints/${encodeURIComponent(other)}` }, eprintUri)).toBe(
      false
    );
  });

  it('does not match a record with neither field', () => {
    expect(describesEprint({ title: 'Unrelated' }, eprintUri)).toBe(false);
  });

  it('survives values that are not records', () => {
    for (const value of [null, undefined, 'string', 7]) {
      expect(describesEprint(value, eprintUri)).toBe(false);
    }
  });
});
