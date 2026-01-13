/**
 * ATProto mocks for testing.
 *
 * @remarks
 * Provides mock implementations of the ATProto Agent and related
 * utilities for testing components that interact with user PDSes.
 *
 * @packageDocumentation
 */

import { vi, type MockedFunction } from 'vitest';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Mock blob reference returned by uploadBlob.
 */
export interface MockBlobRef {
  $type: 'blob';
  ref: {
    $link: string;
  };
  mimeType: string;
  size: number;
}

/**
 * Mock upload blob result.
 */
export interface MockUploadBlobResult {
  success: boolean;
  data: {
    blob: MockBlobRef;
  };
}

/**
 * Mock create record result.
 */
export interface MockCreateRecordResult {
  uri: string;
  cid: string;
}

/**
 * Mock put record result.
 */
export interface MockPutRecordResult {
  uri: string;
  cid: string;
}

/**
 * Mock get record result.
 */
export interface MockGetRecordResult {
  uri: string;
  cid: string;
  value: unknown;
}

/**
 * Mock Agent session.
 */
export interface MockAgentSession {
  did: string;
  handle: string;
  email?: string;
  accessJwt: string;
  refreshJwt: string;
}

/**
 * Mock Agent interface matching @atproto/api Agent.
 */
export interface MockAgent {
  session: MockAgentSession | null;
  uploadBlob: MockedFunction<
    (data: Uint8Array | Blob, opts?: { encoding: string }) => Promise<MockUploadBlobResult>
  >;
  com: {
    atproto: {
      repo: {
        createRecord: MockedFunction<
          (params: {
            repo: string;
            collection: string;
            record: unknown;
            rkey?: string;
          }) => Promise<{ data: MockCreateRecordResult }>
        >;
        deleteRecord: MockedFunction<
          (params: {
            repo: string;
            collection: string;
            rkey: string;
          }) => Promise<{ success: boolean }>
        >;
        putRecord: MockedFunction<
          (params: {
            repo: string;
            collection: string;
            rkey: string;
            record: unknown;
          }) => Promise<{ data: MockPutRecordResult }>
        >;
        getRecord: MockedFunction<
          (params: {
            repo: string;
            collection: string;
            rkey: string;
          }) => Promise<{ data: MockGetRecordResult }>
        >;
      };
    };
  };
  getProfile: MockedFunction<
    (params: { actor: string }) => Promise<{
      data: {
        did: string;
        handle: string;
        displayName?: string;
        description?: string;
        avatar?: string;
      };
    }>
  >;
}

// =============================================================================
// MOCK FACTORIES
// =============================================================================

/**
 * Creates a mock blob reference.
 *
 * @param overrides - Optional property overrides
 * @returns Mock blob reference
 */
export function createMockBlobRef(overrides: Partial<MockBlobRef> = {}): MockBlobRef {
  return {
    $type: 'blob',
    ref: {
      $link: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    },
    mimeType: 'application/pdf',
    size: 1024000,
    ...overrides,
  };
}

/**
 * Creates a mock upload blob result.
 *
 * @param overrides - Optional property overrides
 * @returns Mock upload result
 */
export function createMockUploadBlobResult(
  overrides: Partial<MockUploadBlobResult> = {}
): MockUploadBlobResult {
  return {
    success: true,
    data: {
      blob: createMockBlobRef(),
    },
    ...overrides,
  };
}

/**
 * Creates a mock create record result.
 *
 * @param overrides - Optional property overrides
 * @returns Mock create record result
 */
export function createMockCreateRecordResult(
  overrides: Partial<MockCreateRecordResult> = {}
): MockCreateRecordResult {
  return {
    uri: 'at://did:plc:test123/pub.chive.eprint.submission/abc123',
    cid: 'bafyreiabc123',
    ...overrides,
  };
}

/**
 * Creates a mock Agent session.
 *
 * @param overrides - Optional property overrides
 * @returns Mock session
 */
export function createMockAgentSession(
  overrides: Partial<MockAgentSession> = {}
): MockAgentSession {
  return {
    did: 'did:plc:test123',
    handle: 'testuser.bsky.social',
    accessJwt: 'mock-access-jwt',
    refreshJwt: 'mock-refresh-jwt',
    ...overrides,
  };
}

/**
 * Creates a mock ATProto Agent.
 *
 * @param options - Configuration options
 * @returns Mock Agent instance
 *
 * @example
 * ```typescript
 * const mockAgent = createMockAgent();
 *
 * // Configure specific behavior
 * mockAgent.uploadBlob.mockResolvedValueOnce({
 *   success: true,
 *   data: { blob: createMockBlobRef({ size: 5000000 }) }
 * });
 *
 * // Use in tests
 * vi.mocked(useAgent).mockReturnValue(mockAgent as unknown as Agent);
 * ```
 */
export function createMockAgent(options: { authenticated?: boolean } = {}): MockAgent {
  const { authenticated = true } = options;

  const mockAgent: MockAgent = {
    session: authenticated ? createMockAgentSession() : null,

    uploadBlob: vi.fn().mockImplementation(async (data: Uint8Array | Blob, opts) => {
      const size = data instanceof Blob ? data.size : data.length;
      const mimeType = opts?.encoding ?? 'application/octet-stream';

      return {
        success: true,
        data: {
          blob: createMockBlobRef({ size, mimeType }),
        },
      };
    }),

    com: {
      atproto: {
        repo: {
          createRecord: vi.fn().mockImplementation(async (params) => {
            const rkey = params.rkey ?? generateMockRkey();
            return {
              data: {
                uri: `at://${params.repo}/${params.collection}/${rkey}`,
                cid: `bafyrei${rkey}`,
              },
            };
          }),

          deleteRecord: vi.fn().mockResolvedValue({ success: true }),

          putRecord: vi.fn().mockImplementation(async (params) => {
            return {
              data: {
                uri: `at://${params.repo}/${params.collection}/${params.rkey}`,
                cid: `bafyrei${params.rkey}`,
              },
            };
          }),

          getRecord: vi.fn().mockImplementation(async (params) => {
            return {
              data: {
                uri: `at://${params.repo}/${params.collection}/${params.rkey}`,
                cid: `bafyrei${params.rkey}`,
                value: {},
              },
            };
          }),
        },
      },
    },

    getProfile: vi.fn().mockImplementation(async (params) => {
      return {
        data: {
          did: params.actor,
          handle: 'testuser.bsky.social',
          displayName: 'Test User',
          description: 'A test user profile',
        },
      };
    }),
  };

  return mockAgent;
}

/**
 * Creates an unauthenticated mock Agent.
 *
 * @returns Mock Agent without session
 */
export function createUnauthenticatedMockAgent(): MockAgent {
  return createMockAgent({ authenticated: false });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generates a random mock record key.
 */
function generateMockRkey(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Helper to simulate upload failure.
 *
 * @param agent - Mock agent to configure
 * @param error - Error message
 */
export function simulateUploadFailure(agent: MockAgent, error: string = 'Upload failed'): void {
  agent.uploadBlob.mockRejectedValueOnce(new Error(error));
}

/**
 * Helper to simulate create record failure.
 *
 * @param agent - Mock agent to configure
 * @param error - Error message
 */
export function simulateCreateRecordFailure(
  agent: MockAgent,
  error: string = 'Create record failed'
): void {
  agent.com.atproto.repo.createRecord.mockRejectedValueOnce(new Error(error));
}

/**
 * Helper to verify uploadBlob was called with expected parameters.
 *
 * @param agent - Mock agent to check
 * @param expected - Expected call parameters
 */
export function expectUploadBlobCalled(
  agent: MockAgent,
  expected: { mimeType?: string; minSize?: number; maxSize?: number }
): void {
  expect(agent.uploadBlob).toHaveBeenCalled();

  const calls = agent.uploadBlob.mock.calls;
  const lastCall = calls[calls.length - 1];
  const opts = lastCall[1] as { encoding?: string } | undefined;

  if (expected.mimeType) {
    expect(opts?.encoding).toBe(expected.mimeType);
  }

  if (expected.minSize !== undefined || expected.maxSize !== undefined) {
    const data = lastCall[0] as Uint8Array | Blob;
    const size = data instanceof Blob ? data.size : data.length;

    if (expected.minSize !== undefined) {
      expect(size).toBeGreaterThanOrEqual(expected.minSize);
    }
    if (expected.maxSize !== undefined) {
      expect(size).toBeLessThanOrEqual(expected.maxSize);
    }
  }
}

/**
 * Helper to verify createRecord was called with expected collection.
 *
 * @param agent - Mock agent to check
 * @param collection - Expected collection NSID
 */
export function expectCreateRecordCalled(agent: MockAgent, collection: string): void {
  expect(agent.com.atproto.repo.createRecord).toHaveBeenCalled();

  const calls = agent.com.atproto.repo.createRecord.mock.calls;
  const matchingCall = calls.find((call) => call[0].collection === collection);

  expect(matchingCall).toBeDefined();
}

/**
 * Helper to simulate put record failure.
 *
 * @param agent - Mock agent to configure
 * @param error - Error message
 */
export function simulatePutRecordFailure(
  agent: MockAgent,
  error: string = 'Put record failed'
): void {
  agent.com.atproto.repo.putRecord.mockRejectedValueOnce(new Error(error));
}

/**
 * Helper to simulate get record failure.
 *
 * @param agent - Mock agent to configure
 * @param error - Error message
 */
export function simulateGetRecordFailure(
  agent: MockAgent,
  error: string = 'Get record failed'
): void {
  agent.com.atproto.repo.getRecord.mockRejectedValueOnce(new Error(error));
}

/**
 * Helper to configure get record response with specific value.
 *
 * @param agent - Mock agent to configure
 * @param value - Record value to return
 * @param options - Optional URI and CID overrides
 */
export function configureGetRecordResponse(
  agent: MockAgent,
  value: unknown,
  options: { uri?: string; cid?: string } = {}
): void {
  agent.com.atproto.repo.getRecord.mockResolvedValueOnce({
    data: {
      uri: options.uri ?? 'at://did:plc:test123/pub.chive.eprint.submission/abc123',
      cid: options.cid ?? 'bafyreiabc123',
      value,
    },
  });
}

/**
 * Helper to verify putRecord was called with expected collection.
 *
 * @param agent - Mock agent to check
 * @param collection - Expected collection NSID
 */
export function expectPutRecordCalled(agent: MockAgent, collection: string): void {
  expect(agent.com.atproto.repo.putRecord).toHaveBeenCalled();

  const calls = agent.com.atproto.repo.putRecord.mock.calls;
  const matchingCall = calls.find((call) => call[0].collection === collection);

  expect(matchingCall).toBeDefined();
}

/**
 * Helper to verify getRecord was called with expected parameters.
 *
 * @param agent - Mock agent to check
 * @param expected - Expected call parameters
 */
export function expectGetRecordCalled(
  agent: MockAgent,
  expected: { collection?: string; rkey?: string }
): void {
  expect(agent.com.atproto.repo.getRecord).toHaveBeenCalled();

  const calls = agent.com.atproto.repo.getRecord.mock.calls;
  const matchingCall = calls.find((call) => {
    const params = call[0];
    if (expected.collection && params.collection !== expected.collection) return false;
    if (expected.rkey && params.rkey !== expected.rkey) return false;
    return true;
  });

  expect(matchingCall).toBeDefined();
}
