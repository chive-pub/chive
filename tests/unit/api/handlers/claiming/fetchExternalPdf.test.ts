/**
 * Unit tests for fetchExternalPdf handler.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchExternalPdfHandler } from '../../../../../src/api/handlers/xrpc/claiming/fetchExternalPdf.js';
import type { ChiveEnv } from '../../../../../src/api/types/context.js';
import type { DID } from '../../../../../src/types/atproto.js';
import { NotFoundError, ValidationError } from '../../../../../src/types/errors.js';
import type { ILogger } from '../../../../../src/types/interfaces/logger.interface.js';
import type { ImportedEprint } from '../../../../../src/types/interfaces/plugin.interface.js';

// ============================================================================
// Mock Factories
// ============================================================================

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

// Store original fetch for restoration
const originalFetch = globalThis.fetch;

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_IMPORTED_EPRINT: ImportedEprint = {
  id: 1,
  source: 'arxiv',
  externalId: '2001.12345',
  url: 'https://arxiv.org/abs/2001.12345',
  title: 'Test Paper Title',
  abstract: 'Test abstract.',
  authors: [{ name: 'Test Author' }],
  publicationDate: new Date('2020-01-15'),
  categories: ['cs.CL'],
  pdfUrl: 'https://arxiv.org/pdf/2001.12345.pdf',
  importedByPlugin: 'pub.chive.plugin.arxiv',
  importedAt: new Date('2024-01-15T10:00:00Z'),
  lastSyncedAt: new Date('2024-01-15T12:00:00Z'),
  syncStatus: 'active',
  claimStatus: 'unclaimed',
};

const SAMPLE_PDF_BUFFER = new ArrayBuffer(1024);

// ============================================================================
// Tests
// ============================================================================

describe('fetchExternalPdfHandler', () => {
  let mockLogger: ILogger;
  let mockClaimingService: {
    getOrImportFromExternal: ReturnType<typeof vi.fn>;
  };
  let app: Hono<ChiveEnv>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockClaimingService = {
      getOrImportFromExternal: vi.fn(),
    };

    // Create a test app with the handler
    app = new Hono<ChiveEnv>();

    // Error handling middleware
    app.onError((err, c) => {
      if (err instanceof NotFoundError) {
        return c.json({ error: err.message }, 404);
      }
      if (err instanceof ValidationError) {
        return c.json({ error: err.message }, 400);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    });

    // Mock middleware to set context
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      c.set('user', {
        did: 'did:plc:testuser' as DID,
        handle: 'test.user',
        isAdmin: false,
        isPremium: false,
        isAlphaTester: true,
      });
      c.set('services', {
        claiming: mockClaimingService,
      } as unknown as ChiveEnv['Variables']['services']);
      await next();
    });

    app.get('/xrpc/pub.chive.claiming.fetchExternalPdf', fetchExternalPdfHandler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  it('should return 401 when not authenticated', async () => {
    // Create app without user context
    const unauthApp = new Hono<ChiveEnv>();
    unauthApp.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      c.set('user', undefined as unknown as ChiveEnv['Variables']['user']);
      c.set('services', {
        claiming: mockClaimingService,
      } as unknown as ChiveEnv['Variables']['services']);
      await next();
    });
    unauthApp.get('/xrpc/pub.chive.claiming.fetchExternalPdf', fetchExternalPdfHandler);

    const res = await unauthApp.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?source=arxiv&externalId=2001.12345'
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Authentication required');
  });

  it('should return 400 when source parameter is missing', async () => {
    const res = await app.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?externalId=2001.12345'
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Missing source or externalId parameter');
  });

  it('should return 400 when externalId parameter is missing', async () => {
    const res = await app.request('/xrpc/pub.chive.claiming.fetchExternalPdf?source=arxiv');

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Missing source or externalId parameter');
  });

  it('should return 404 when paper not found', async () => {
    mockClaimingService.getOrImportFromExternal.mockResolvedValue(null);

    const res = await app.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?source=arxiv&externalId=2001.12345'
    );

    expect(res.status).toBe(404);
  });

  it('should return 404 when paper has no PDF URL', async () => {
    mockClaimingService.getOrImportFromExternal.mockResolvedValue({
      ...SAMPLE_IMPORTED_EPRINT,
      pdfUrl: undefined,
    });

    const res = await app.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?source=arxiv&externalId=2001.12345'
    );

    expect(res.status).toBe(404);
  });

  it('should return 400 when PDF URL is from unauthorized domain', async () => {
    mockClaimingService.getOrImportFromExternal.mockResolvedValue({
      ...SAMPLE_IMPORTED_EPRINT,
      pdfUrl: 'https://malicious-site.com/evil.pdf',
    });

    const res = await app.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?source=arxiv&externalId=2001.12345'
    );

    expect(res.status).toBe(400);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Blocked PDF fetch from unauthorized domain',
      expect.objectContaining({
        pdfUrl: 'https://malicious-site.com/evil.pdf',
      })
    );
  });

  it('should proxy PDF from arxiv.org successfully', async () => {
    mockClaimingService.getOrImportFromExternal.mockResolvedValue(SAMPLE_IMPORTED_EPRINT);

    // Mock fetch to return PDF
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      arrayBuffer: () => Promise.resolve(SAMPLE_PDF_BUFFER),
    });
    globalThis.fetch = mockFetch;

    const res = await app.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?source=arxiv&externalId=2001.12345'
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="arxiv-2001.12345.pdf"'
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://arxiv.org/pdf/2001.12345.pdf',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('Chive'),
          Accept: 'application/pdf',
        }),
      })
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      'PDF fetched successfully',
      expect.objectContaining({
        source: 'arxiv',
        externalId: '2001.12345',
      })
    );
  });

  it('should proxy PDF from export.arxiv.org successfully', async () => {
    mockClaimingService.getOrImportFromExternal.mockResolvedValue({
      ...SAMPLE_IMPORTED_EPRINT,
      pdfUrl: 'https://export.arxiv.org/pdf/2001.12345.pdf',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      arrayBuffer: () => Promise.resolve(SAMPLE_PDF_BUFFER),
    });
    globalThis.fetch = mockFetch;

    const res = await app.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?source=arxiv&externalId=2001.12345'
    );

    expect(res.status).toBe(200);
  });

  it('should proxy PDF from semanticscholar.org successfully', async () => {
    mockClaimingService.getOrImportFromExternal.mockResolvedValue({
      ...SAMPLE_IMPORTED_EPRINT,
      source: 'semanticscholar',
      pdfUrl: 'https://pdfs.semanticscholar.org/abc123/paper.pdf',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      arrayBuffer: () => Promise.resolve(SAMPLE_PDF_BUFFER),
    });
    globalThis.fetch = mockFetch;

    const res = await app.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?source=semanticscholar&externalId=123'
    );

    expect(res.status).toBe(200);
  });

  it('should return 404 when external fetch fails', async () => {
    mockClaimingService.getOrImportFromExternal.mockResolvedValue(SAMPLE_IMPORTED_EPRINT);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    globalThis.fetch = mockFetch;

    const res = await app.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?source=arxiv&externalId=2001.12345'
    );

    expect(res.status).toBe(404);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to fetch external PDF',
      undefined,
      expect.objectContaining({
        status: 404,
      })
    );
  });

  it('should warn when content-type is not PDF but continue', async () => {
    mockClaimingService.getOrImportFromExternal.mockResolvedValue(SAMPLE_IMPORTED_EPRINT);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: () => Promise.resolve(SAMPLE_PDF_BUFFER),
    });
    globalThis.fetch = mockFetch;

    const res = await app.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?source=arxiv&externalId=2001.12345'
    );

    expect(res.status).toBe(200);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'External URL did not return PDF content type',
      expect.objectContaining({
        contentType: 'text/html',
      })
    );
  });

  it('should set proper cache headers', async () => {
    mockClaimingService.getOrImportFromExternal.mockResolvedValue(SAMPLE_IMPORTED_EPRINT);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      arrayBuffer: () => Promise.resolve(SAMPLE_PDF_BUFFER),
    });
    globalThis.fetch = mockFetch;

    const res = await app.request(
      '/xrpc/pub.chive.claiming.fetchExternalPdf?source=arxiv&externalId=2001.12345'
    );

    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
  });
});
