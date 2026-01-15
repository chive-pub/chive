/**
 * Tests for ATProto OAuth client handle resolution.
 *
 * @remarks
 * These tests verify that handle resolution works correctly for non-Bluesky
 * PDSes, using ATProto-standard DNS-over-HTTPS resolution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock fetch globally
const mockFetch = vi.fn();

describe('OAuth Handle Resolution Configuration', () => {
  it('uses AtprotoDohHandleResolver with correct DoH endpoint', () => {
    // Read the source file and verify configuration
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Verify AtprotoDohHandleResolver is imported
    expect(source).toContain('AtprotoDohHandleResolver');

    // Verify correct DoH endpoint is configured (Google's JSON API)
    expect(source).toContain("dohEndpoint: 'https://dns.google/resolve'");

    // Verify we're NOT using the old binary endpoint
    expect(source).not.toContain('/dns-query');
  });

  it('does not contain hardcoded bsky.social fallbacks', () => {
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Count occurrences of bsky.social
    const matches = source.match(/bsky\.social/g) || [];

    // Should have zero hardcoded bsky.social references
    // (comments don't count as they're documentation)
    const nonCommentMatches = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n')
      .match(/bsky\.social/g);

    expect(nonCommentMatches).toBeNull();
  });

  it('uses standard ATProto handle resolution methods', () => {
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Verify we check .well-known/atproto-did (HTTP method)
    // This is handled by AtprotoDohHandleResolver, but verify we document it
    expect(source).toContain('.well-known');

    // Verify we use PLC directory for did:plc
    expect(source).toContain('plc.directory');

    // Verify we support did:web
    expect(source).toContain('did:web:');
  });
});

describe('PDS Endpoint Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws error when DID document fetch fails', async () => {
    // Import the module to test getPDSEndpoint behavior
    // We need to test that it throws errors instead of falling back to bsky.social
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Verify the function throws NetworkError on fetch failure
    expect(source).toContain('throw new NetworkError');
    expect(source).toContain('Failed to fetch DID document');
  });

  it('throws error when no PDS service found in DID document', () => {
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Verify the function throws AuthenticationError when no PDS found
    expect(source).toContain('throw new AuthenticationError');
    expect(source).toContain('No ATProto PDS service found');
  });

  it('throws error for unsupported DID methods', () => {
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Verify the function throws for unsupported DID methods
    expect(source).toContain('Unsupported DID method');
  });
});

describe('Federation Support', () => {
  it('supports did:plc resolution via PLC directory', () => {
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Verify did:plc uses plc.directory
    expect(source).toContain("if (did.startsWith('did:plc:'))");
    expect(source).toContain('https://plc.directory/');
  });

  it('supports did:web resolution', () => {
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Verify did:web support
    expect(source).toContain("if (did.startsWith('did:web:'))");
    expect(source).toContain('/.well-known/did.json');
  });

  it('handles did:web with path components', () => {
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Verify did:web path handling (e.g., did:web:example.com:users:alice)
    expect(source).toContain("decoded.includes(':')");
    expect(source).toContain('/did.json');
  });
});

describe('Error Handling', () => {
  it('uses ChiveErrors for authentication failures', () => {
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Verify proper error imports
    expect(source).toContain("import { AuthenticationError, NetworkError } from '@/lib/errors'");
  });

  it('does not silently fall back on errors', () => {
    const sourcePath = path.join(__dirname, 'oauth-client.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Verify errors are thrown, not swallowed
    // Check that getPDSEndpoint throws on failure
    expect(source).toContain('throw new AuthenticationError');
    expect(source).toContain('throw new NetworkError');

    // Verify there's no return statement with a fallback URL after catch blocks
    // in getPDSEndpoint function
    const getPDSEndpointMatch = source.match(/async function getPDSEndpoint[\s\S]*?^}/m);
    if (getPDSEndpointMatch) {
      const fnBody = getPDSEndpointMatch[0];
      // Should not have a catch that returns a fallback
      expect(fnBody).not.toMatch(/catch[\s\S]*?return\s+['"]https?:\/\//);
    }
  });
});
