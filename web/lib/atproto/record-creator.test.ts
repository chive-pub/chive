/**
 * Tests for ATProto record creation utilities.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi } from 'vitest';
import type { Agent } from '@atproto/api';
import {
  uploadBlob,
  uploadDocument,
  createEprintRecord,
  createFieldProposalRecord,
  createVoteRecord,
  deleteRecord,
  updateEndorsementRecord,
  updateChiveProfileRecord,
  isAgentAuthenticated,
  getAuthenticatedDid,
  buildAtUri,
  parseAtUri,
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
    affiliations: { name: string; rorId?: string; department?: string }[];
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
  it('creates a eprint record in user PDS', async () => {
    const agent = createMockAgent();
    const documentFile = createMockFile('paper.pdf', 'application/pdf');

    const result = await createEprintRecord(agent, {
      documentFile,
      title: 'Test Paper',
      abstract: 'This is a test abstract that is long enough to pass validation.',
      authors: [createTestAuthor()],
      fieldNodes: [{ uri: 'at://did:plc:governance/pub.chive.graph.field/ml' }],
      license: 'cc-by-4.0',
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
      fieldNodes: [{ uri: 'at://did:plc:governance/pub.chive.graph.field/ml' }],
      keywords: ['machine learning', 'ai'],
      license: 'cc-by-4.0',
    });

    const createRecordCall = (agent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(createRecordCall.record.keywords).toEqual(['machine learning', 'ai']);
    expect(createRecordCall.record.license).toBe('cc-by-4.0');
  });

  it('creates a eprint record with DOCX document', async () => {
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
      fieldNodes: [{ uri: 'at://did:plc:governance/pub.chive.graph.field/ml' }],
      license: 'cc-by-4.0',
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
        fieldNodes: [{ uri: 'at://did:plc:governance/pub.chive.graph.field/ml' }],
        license: 'cc-by-4.0',
      })
    ).rejects.toThrow('Agent is not authenticated');
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
