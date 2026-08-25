/**
 * Unit tests for authentication and PDS-ownership enforcement in registerPDS.
 *
 * @remarks
 * Registering a PDS adds a host to the scan registry, which the scanner later
 * enumerates. These tests pin the two guards that keep an anonymous or
 * unrelated caller from seeding the registry with a host they do not control.
 */

import type { Context } from 'hono';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { registerPDS } from '@/api/handlers/xrpc/sync/registerPDS.js';
import type { ChiveEnv } from '@/api/types/context.js';
import type { DID } from '@/types/atproto.js';
import { AuthenticationError, ValidationError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// The registerPDS handler runs every candidate URL through the SSRF guard,
// which resolves the hostname before any fetch. Test hostnames do not exist in
// DNS, so resolution is stubbed to a public address; the guard's own rejection
// paths are covered in tests/unit/utils/ssrf-guard.test.ts.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34' }]),
}));

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const mockUser = {
  did: 'did:plc:user123' as DID,
  handle: 'user.test',
  isAdmin: false,
};

/** Builds a minimal Response stand-in for the fields the handler reads. */
const stubResponse = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: () => Promise.resolve(body) }) as unknown as Response;

/**
 * Builds a fetch mock that answers PLC resolution with the given endpoint
 * (or a non-ok response when null) and any other request with 200 OK.
 */
function mockFetchWithPlcEndpoint(
  endpoint: string | null
): Mock<(input: string | URL | Request) => Promise<Response>> {
  return vi.fn((input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('plc.directory')) {
      if (endpoint === null) {
        return Promise.resolve(stubResponse({}, false, 404));
      }
      return Promise.resolve(
        stubResponse({
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: endpoint,
            },
          ],
        })
      );
    }
    return Promise.resolve(stubResponse({}));
  });
}

describe('registerPDS authentication and ownership', () => {
  let mockLogger: ILogger;
  let mockPDSRegistry: { registerPDS: ReturnType<typeof vi.fn>; getPDS: ReturnType<typeof vi.fn> };
  let mockPDSScanner: { scanDID: ReturnType<typeof vi.fn> };

  const createContext = (user: typeof mockUser | undefined): Context<ChiveEnv> =>
    ({
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return { pdsRegistry: mockPDSRegistry, pdsScanner: mockPDSScanner };
          case 'logger':
            return mockLogger;
          case 'user':
            return user;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    }) as unknown as Context<ChiveEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockPDSRegistry = {
      registerPDS: vi.fn().mockResolvedValue(undefined),
      getPDS: vi.fn().mockResolvedValue(null),
    };
    mockPDSScanner = { scanDID: vi.fn().mockResolvedValue(0) };
  });

  it('declares authentication as required', () => {
    expect(registerPDS.auth).toBe(true);
  });

  it('rejects an unauthenticated caller', async () => {
    global.fetch = mockFetchWithPlcEndpoint(null);

    await expect(
      registerPDS.handler({
        params: undefined,
        input: { pdsUrl: 'https://attacker-pds.example.com' },
        auth: null,
        c: createContext(undefined),
      })
    ).rejects.toThrow(AuthenticationError);

    expect(mockPDSRegistry.registerPDS).not.toHaveBeenCalled();
  });

  it('rejects a host that is not the caller PDS', async () => {
    global.fetch = mockFetchWithPlcEndpoint('https://user-pds.example.com');

    await expect(
      registerPDS.handler({
        params: undefined,
        input: { pdsUrl: 'https://attacker-pds.example.com' },
        auth: null,
        c: createContext(mockUser),
      })
    ).rejects.toThrow(ValidationError);

    expect(mockPDSRegistry.registerPDS).not.toHaveBeenCalled();
  });

  // The registered host is stored and revisited by the scanner, so a URL
  // pointing at cloud metadata or loopback would give the caller a persistent
  // request generator aimed inside the deployment. An IP literal needs no DNS,
  // so this reaches the guard regardless of how resolution is stubbed.
  it.each([
    ['cloud metadata', 'https://169.254.169.254/latest/meta-data/'],
    ['loopback', 'https://127.0.0.1:5432'],
    ['IPv6 loopback', 'https://[::1]/admin'],
  ])('refuses to register a %s address', async (_label, pdsUrl) => {
    global.fetch = mockFetchWithPlcEndpoint(null);

    await expect(
      registerPDS.handler({
        params: undefined,
        input: { pdsUrl },
        auth: null,
        c: createContext(mockUser),
      })
    ).rejects.toThrow(/non-public address/);

    expect(mockPDSRegistry.registerPDS).not.toHaveBeenCalled();
  });

  it('registers the caller own PDS', async () => {
    global.fetch = mockFetchWithPlcEndpoint('https://user-pds.example.com/');

    const result = await registerPDS.handler({
      params: undefined,
      input: { pdsUrl: 'https://user-pds.example.com' },
      auth: null,
      c: createContext(mockUser),
    });

    expect(result.body.registered).toBe(true);
    expect(mockPDSRegistry.registerPDS).toHaveBeenCalledWith(
      'https://user-pds.example.com',
      'user_registration'
    );
  });

  it('registers when DID resolution is inconclusive', async () => {
    // A directory outage must not block indexing for legitimate users.
    global.fetch = mockFetchWithPlcEndpoint(null);

    const result = await registerPDS.handler({
      params: undefined,
      input: { pdsUrl: 'https://custom-pds.example.com' },
      auth: null,
      c: createContext(mockUser),
    });

    expect(result.body.registered).toBe(true);
    expect(mockPDSRegistry.registerPDS).toHaveBeenCalledWith(
      'https://custom-pds.example.com',
      'user_registration'
    );
  });

  it('does not resolve the caller DID for an already registered PDS', async () => {
    mockPDSRegistry.getPDS.mockResolvedValue({
      pdsUrl: 'https://existing-pds.example.com',
      status: 'active',
    });
    const fetchMock = mockFetchWithPlcEndpoint('https://user-pds.example.com');
    global.fetch = fetchMock;

    const result = await registerPDS.handler({
      params: undefined,
      input: { pdsUrl: 'https://existing-pds.example.com' },
      auth: null,
      c: createContext(mockUser),
    });

    expect(result.body.status).toBe('already_exists');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
