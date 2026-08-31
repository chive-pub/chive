/**
 * Tests for the Chive MCP server.
 *
 * @remarks
 * The server is a thin adapter over the public XRPC API: it holds no
 * credentials, reaches no database, and exposes only read operations. These
 * tests pin that shape — an agent-facing surface that could write, or that
 * needed a session, would be a different and much more dangerous thing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { callXrpc, createChiveMcpServer, DEFAULT_API_URL } from '../../../src/mcp/server.js';

const originalFetch = global.fetch;

describe('callXrpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls the named method on the configured deployment', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ found: false }) });
    global.fetch = fetchMock as never;

    await callXrpc('https://api.example.test', 'pub.chive.resolve.byExternalId', {
      system: 'doi',
      identifier: '10.1000/abc',
    });

    const url = (fetchMock.mock.calls[0] as [URL])[0];
    expect(url.origin + url.pathname).toBe(
      'https://api.example.test/xrpc/pub.chive.resolve.byExternalId'
    );
    expect(url.searchParams.get('system')).toBe('doi');
    expect(url.searchParams.get('identifier')).toBe('10.1000/abc');
  });

  it('does not double the slash when the base URL has a trailing one', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    global.fetch = fetchMock as never;

    await callXrpc('https://api.example.test/', 'pub.chive.eprint.getSubmission', {
      uri: 'at://x',
    });

    const url = (fetchMock.mock.calls[0] as [URL])[0];
    expect(url.pathname).toBe('/xrpc/pub.chive.eprint.getSubmission');
  });

  it('omits parameters that were not supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    global.fetch = fetchMock as never;

    await callXrpc('https://api.example.test', 'pub.chive.eprint.searchSubmissions', {
      q: 'semantics',
      limit: undefined,
    });

    const url = (fetchMock.mock.calls[0] as [URL])[0];
    expect(url.searchParams.has('limit')).toBe(false);
  });

  it('reports the failing method in the error, since that is what the agent sees', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Invalid identifier' }),
    }) as never;

    await expect(
      callXrpc('https://api.example.test', 'pub.chive.resolve.byExternalId', {})
    ).rejects.toThrow(/pub\.chive\.resolve\.byExternalId failed \(400\): Invalid identifier/);
  });

  it('still reports usefully when the error body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    }) as never;

    await expect(
      callXrpc('https://api.example.test', 'pub.chive.eprint.getSubmission', {})
    ).rejects.toThrow(/502/);
  });

  it('clears its timeout when a call settles', async () => {
    // Otherwise every tool call leaves a live 15-second timer behind.
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as never;

    await callXrpc('https://api.example.test', 'pub.chive.eprint.getSubmission', {});

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

describe('createChiveMcpServer', () => {
  it('builds against the production deployment by default', () => {
    expect(DEFAULT_API_URL).toBe('https://api.chive.pub');
  });

  it('constructs without credentials of any kind', () => {
    // The point of the design: it reads what a browser could read, so there is
    // no session for an agent to borrow.
    expect(() => createChiveMcpServer('https://api.example.test')).not.toThrow();
  });
});
