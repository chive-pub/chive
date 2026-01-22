/**
 * Tests for session management.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

import { createSessionManager, getPersistedSessionId, clearPersistedSessionId } from './session';

describe('Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPersistedSessionId', () => {
    it('returns existing session ID from sessionStorage', () => {
      sessionStorageMock.setItem('chive:faro:sessionId', 'existing-session-123');

      const sessionId = getPersistedSessionId();

      expect(sessionId).toBe('existing-session-123');
    });

    it('generates new session ID if none exists', () => {
      const sessionId = getPersistedSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('persists generated session ID to sessionStorage', () => {
      const sessionId = getPersistedSessionId();

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('chive:faro:sessionId', sessionId);
    });

    it('returns consistent session ID across calls', () => {
      const sessionId1 = getPersistedSessionId();
      const sessionId2 = getPersistedSessionId();

      expect(sessionId1).toBe(sessionId2);
    });
  });

  describe('clearPersistedSessionId', () => {
    it('removes session ID from sessionStorage', () => {
      sessionStorageMock.setItem('chive:faro:sessionId', 'session-to-clear');

      clearPersistedSessionId();

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('chive:faro:sessionId');
    });
  });

  describe('createSessionManager', () => {
    const mockFaroApi = {
      setUser: vi.fn(),
      resetUser: vi.fn(),
      setSession: vi.fn(),
      getSession: vi.fn(() => ({ id: 'test-session-id' })),
      pushEvent: vi.fn(),
    };

    const mockFaro = {
      api: mockFaroApi,
    } as unknown as Parameters<typeof createSessionManager>[0];

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates a session manager with correct interface', () => {
      const manager = createSessionManager(mockFaro);

      expect(manager).toHaveProperty('getSessionId');
      expect(manager).toHaveProperty('setUser');
      expect(manager).toHaveProperty('clearUser');
      expect(manager).toHaveProperty('setSessionAttributes');
      expect(manager).toHaveProperty('pushView');
    });

    it('returns session ID from getSessionId', () => {
      const manager = createSessionManager(mockFaro);
      const sessionId = manager.getSessionId();

      expect(sessionId).toBe('test-session-id');
      expect(mockFaroApi.getSession).toHaveBeenCalled();
    });

    it('returns undefined when Faro is null', () => {
      const manager = createSessionManager(null);
      const sessionId = manager.getSessionId();

      expect(sessionId).toBeUndefined();
    });

    it('setUser updates user context with hashed ID', () => {
      const manager = createSessionManager(mockFaro);

      manager.setUser({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      });

      expect(mockFaroApi.setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^h_/), // Hashed IDs start with 'h_'
          username: 'authenticated', // Redacted
          email: 'provided', // Redacted
        })
      );
    });

    it('setUser does nothing when Faro is null', () => {
      const manager = createSessionManager(null);

      // Should not throw
      expect(() => {
        manager.setUser({ id: 'user-123' });
      }).not.toThrow();
    });

    it('clearUser resets user context', () => {
      const manager = createSessionManager(mockFaro);

      manager.clearUser();

      expect(mockFaroApi.resetUser).toHaveBeenCalled();
    });

    it('clearUser does nothing when Faro is null', () => {
      const manager = createSessionManager(null);

      // Should not throw
      expect(() => {
        manager.clearUser();
      }).not.toThrow();
    });

    it('setSessionAttributes sets session attributes', () => {
      const manager = createSessionManager(mockFaro);

      manager.setSessionAttributes({
        route: '/eprints',
        features: ['beta', 'dark-mode'],
        role: 'editor',
        tenant: 'arxiv',
      });

      expect(mockFaroApi.setSession).toHaveBeenCalledWith({
        attributes: {
          route: '/eprints',
          features: 'beta,dark-mode',
          role: 'editor',
          tenant: 'arxiv',
        },
      });
    });

    it('pushView pushes view event', () => {
      const manager = createSessionManager(mockFaro);

      manager.pushView('/eprints/123', { source: 'search' });

      expect(mockFaroApi.pushEvent).toHaveBeenCalledWith('view', {
        name: '/eprints/123',
        source: 'search',
      });
    });
  });
});

describe('Session ID generation', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
  });

  it('generates unique session IDs', () => {
    // Clear to force generation
    sessionStorageMock.clear();
    const sessionId1 = getPersistedSessionId();

    sessionStorageMock.clear();
    const sessionId2 = getPersistedSessionId();

    // Note: There's a small chance these could be equal with random generation,
    // but it's extremely unlikely
    expect(sessionId1).not.toBe(sessionId2);
  });

  it('generated session ID has valid format', () => {
    sessionStorageMock.clear();
    const sessionId = getPersistedSessionId();

    // Session IDs should match the format: timestamp-random
    expect(sessionId).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });
});
