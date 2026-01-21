/**
 * Tests for paper session management.
 *
 * @remarks
 * Tests the paper session management functions used for
 * submitting eprints to paper-specific PDSes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OAuthSession } from '@atproto/oauth-client-browser';

import {
  setPaperSession,
  getPaperSession,
  getActivePaperSession,
  hasPaperSession,
  clearPaperSession,
  clearAllPaperSessions,
  isPaperSessionValid,
  getPaperAgent,
  getAllPaperSessions,
} from './paper-session';

// Mock @atproto/api Agent
vi.mock('@atproto/api', () => ({
  Agent: vi.fn().mockImplementation((session) => ({
    did: session.did,
    session,
  })),
}));

describe('paper-session', () => {
  // Create mock OAuth session
  const createMockSession = (did: string): OAuthSession =>
    ({
      did,
      server: new URL('https://bsky.social'),
      // Add minimal required properties for OAuthSession
    }) as unknown as OAuthSession;

  beforeEach(() => {
    // Clear all sessions before each test
    clearAllPaperSessions();
  });

  describe('setPaperSession', () => {
    it('creates and stores a paper session', () => {
      const session = createMockSession('did:plc:paper1');
      const result = setPaperSession(session, 'https://bsky.social', 'paper.bsky.social');

      expect(result).toBeDefined();
      expect(result.paperDid).toBe('did:plc:paper1');
      expect(result.paperHandle).toBe('paper.bsky.social');
      expect(result.pdsEndpoint).toBe('https://bsky.social');
      expect(result.authenticatedAt).toBeLessThanOrEqual(Date.now());
    });

    it('sets the session as active', () => {
      const session = createMockSession('did:plc:paper1');
      setPaperSession(session, 'https://bsky.social', 'paper.bsky.social');

      const active = getActivePaperSession();
      expect(active).not.toBeNull();
      expect(active?.paperDid).toBe('did:plc:paper1');
    });

    it('overwrites existing session with same DID', () => {
      const session1 = createMockSession('did:plc:paper1');
      const session2 = createMockSession('did:plc:paper1');

      setPaperSession(session1, 'https://pds1.social', 'paper1.bsky.social');
      const result = setPaperSession(session2, 'https://pds2.social', 'paper2.bsky.social');

      expect(result.pdsEndpoint).toBe('https://pds2.social');
      expect(result.paperHandle).toBe('paper2.bsky.social');
      expect(getAllPaperSessions()).toHaveLength(1);
    });
  });

  describe('getPaperSession', () => {
    it('returns null for non-existent session', () => {
      const result = getPaperSession('did:plc:nonexistent');
      expect(result).toBeNull();
    });

    it('returns session by DID', () => {
      const session = createMockSession('did:plc:paper1');
      setPaperSession(session, 'https://bsky.social', 'paper.bsky.social');

      const result = getPaperSession('did:plc:paper1');
      expect(result).not.toBeNull();
      expect(result?.paperDid).toBe('did:plc:paper1');
    });
  });

  describe('getActivePaperSession', () => {
    it('returns null when no sessions exist', () => {
      const result = getActivePaperSession();
      expect(result).toBeNull();
    });

    it('returns the most recently set session', () => {
      const session1 = createMockSession('did:plc:paper1');
      const session2 = createMockSession('did:plc:paper2');

      setPaperSession(session1, 'https://bsky.social', 'paper1.bsky.social');
      setPaperSession(session2, 'https://bsky.social', 'paper2.bsky.social');

      const active = getActivePaperSession();
      expect(active?.paperDid).toBe('did:plc:paper2');
    });
  });

  describe('hasPaperSession', () => {
    it('returns false when no sessions exist', () => {
      expect(hasPaperSession()).toBe(false);
    });

    it('returns true when active session exists', () => {
      const session = createMockSession('did:plc:paper1');
      setPaperSession(session, 'https://bsky.social', 'paper.bsky.social');

      expect(hasPaperSession()).toBe(true);
    });

    it('returns false after clearing active session', () => {
      const session = createMockSession('did:plc:paper1');
      setPaperSession(session, 'https://bsky.social', 'paper.bsky.social');
      clearPaperSession();

      expect(hasPaperSession()).toBe(false);
    });
  });

  describe('clearPaperSession', () => {
    it('clears specific session by DID', () => {
      const session1 = createMockSession('did:plc:paper1');
      const session2 = createMockSession('did:plc:paper2');

      setPaperSession(session1, 'https://bsky.social', 'paper1.bsky.social');
      setPaperSession(session2, 'https://bsky.social', 'paper2.bsky.social');

      clearPaperSession('did:plc:paper1');

      expect(getPaperSession('did:plc:paper1')).toBeNull();
      expect(getPaperSession('did:plc:paper2')).not.toBeNull();
    });

    it('clears active session when no DID provided', () => {
      const session = createMockSession('did:plc:paper1');
      setPaperSession(session, 'https://bsky.social', 'paper.bsky.social');

      clearPaperSession();

      expect(hasPaperSession()).toBe(false);
      expect(getPaperSession('did:plc:paper1')).toBeNull();
    });

    it('clears active DID when clearing active session', () => {
      const session1 = createMockSession('did:plc:paper1');
      const session2 = createMockSession('did:plc:paper2');

      setPaperSession(session1, 'https://bsky.social', 'paper1.bsky.social');
      setPaperSession(session2, 'https://bsky.social', 'paper2.bsky.social');

      // paper2 is active, clear it
      clearPaperSession('did:plc:paper2');

      // Active should now be null
      expect(hasPaperSession()).toBe(false);
      // But paper1 should still exist
      expect(getPaperSession('did:plc:paper1')).not.toBeNull();
    });
  });

  describe('clearAllPaperSessions', () => {
    it('clears all sessions', () => {
      const session1 = createMockSession('did:plc:paper1');
      const session2 = createMockSession('did:plc:paper2');

      setPaperSession(session1, 'https://bsky.social', 'paper1.bsky.social');
      setPaperSession(session2, 'https://bsky.social', 'paper2.bsky.social');

      clearAllPaperSessions();

      expect(getAllPaperSessions()).toHaveLength(0);
      expect(hasPaperSession()).toBe(false);
    });
  });

  describe('isPaperSessionValid', () => {
    it('returns false for non-existent session', () => {
      expect(isPaperSessionValid('did:plc:nonexistent')).toBe(false);
    });

    it('returns true for fresh session', () => {
      const session = createMockSession('did:plc:paper1');
      setPaperSession(session, 'https://bsky.social', 'paper.bsky.social');

      expect(isPaperSessionValid('did:plc:paper1')).toBe(true);
    });

    it('respects custom maxAge', () => {
      const session = createMockSession('did:plc:paper1');
      setPaperSession(session, 'https://bsky.social', 'paper.bsky.social');

      // With 0ms maxAge, session should be invalid immediately
      expect(isPaperSessionValid('did:plc:paper1', 0)).toBe(false);
    });
  });

  describe('getPaperAgent', () => {
    it('returns null when no active session', () => {
      expect(getPaperAgent()).toBeNull();
    });

    it('returns agent for active session', () => {
      const session = createMockSession('did:plc:paper1');
      setPaperSession(session, 'https://bsky.social', 'paper.bsky.social');

      const agent = getPaperAgent();
      expect(agent).not.toBeNull();
    });
  });

  describe('getAllPaperSessions', () => {
    it('returns empty array when no sessions', () => {
      expect(getAllPaperSessions()).toEqual([]);
    });

    it('returns all stored sessions', () => {
      const session1 = createMockSession('did:plc:paper1');
      const session2 = createMockSession('did:plc:paper2');

      setPaperSession(session1, 'https://bsky.social', 'paper1.bsky.social');
      setPaperSession(session2, 'https://bsky.social', 'paper2.bsky.social');

      const all = getAllPaperSessions();
      expect(all).toHaveLength(2);
      expect(all.map((s) => s.paperDid).sort()).toEqual(['did:plc:paper1', 'did:plc:paper2']);
    });
  });
});
