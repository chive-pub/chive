/**
 * Tests for paper OAuth popup flow.
 *
 * @remarks
 * Tests the popup-based OAuth flow for paper accounts.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  authenticatePaperInPopup,
  cancelPaperAuthentication,
  isPaperAuthInProgress,
  postPaperSessionToOpener,
  postPaperErrorToOpener,
  type PaperOAuthMessage,
} from './paper-oauth-popup';
import { clearAllPaperSessions } from './paper-session';

// Mock window.open
const mockPopup = {
  closed: false,
  close: vi.fn(),
};

describe('paper-oauth-popup', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    clearAllPaperSessions();

    // Reset popup mock state
    mockPopup.closed = false;

    // Mock window.open
    vi.stubGlobal(
      'open',
      vi.fn(() => mockPopup)
    );

    // Mock window.location
    vi.stubGlobal('location', {
      origin: 'https://chive.pub',
      href: 'https://chive.pub',
    });

    // Mock window.opener (for popup tests)
    vi.stubGlobal('opener', null);

    // Mock window.addEventListener for message listener
    vi.stubGlobal('addEventListener', vi.fn());
  });

  afterEach(() => {
    // Cancel any pending auth
    if (isPaperAuthInProgress()) {
      cancelPaperAuthentication();
    }
    vi.unstubAllGlobals();
  });

  describe('isPaperAuthInProgress', () => {
    it('returns false initially', () => {
      expect(isPaperAuthInProgress()).toBe(false);
    });
  });

  describe('authenticatePaperInPopup', () => {
    it('opens popup with correct URL', async () => {
      // Start auth but don't await (it will wait for callback)
      const authPromise = authenticatePaperInPopup('paper.bsky.social');

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/paper-popup'),
        'paper-oauth',
        expect.any(String)
      );

      const calledUrl = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toContain('handle=paper.bsky.social');

      // Clean up
      cancelPaperAuthentication();
      await expect(authPromise).rejects.toThrow('cancelled');
    });

    it('sets auth in progress', async () => {
      const authPromise = authenticatePaperInPopup('paper.bsky.social');

      expect(isPaperAuthInProgress()).toBe(true);

      // Clean up
      cancelPaperAuthentication();
      await expect(authPromise).rejects.toThrow('cancelled');
    });

    it('throws if popup is blocked', async () => {
      // Mock popup being blocked
      vi.stubGlobal(
        'open',
        vi.fn(() => null)
      );

      await expect(authenticatePaperInPopup('paper.bsky.social')).rejects.toThrow(
        'Failed to open popup'
      );
    });

    it('throws if auth already in progress', async () => {
      const authPromise1 = authenticatePaperInPopup('paper1.bsky.social');

      await expect(authenticatePaperInPopup('paper2.bsky.social')).rejects.toThrow(
        'already in progress'
      );

      // Clean up
      cancelPaperAuthentication();
      await expect(authPromise1).rejects.toThrow('cancelled');
    });
  });

  describe('cancelPaperAuthentication', () => {
    it('closes popup and rejects promise', async () => {
      const authPromise = authenticatePaperInPopup('paper.bsky.social');

      cancelPaperAuthentication();

      await expect(authPromise).rejects.toThrow('cancelled');
      expect(mockPopup.close).toHaveBeenCalled();
      expect(isPaperAuthInProgress()).toBe(false);
    });

    it('is safe to call when no auth in progress', () => {
      // Should not throw
      expect(() => cancelPaperAuthentication()).not.toThrow();
    });
  });

  describe('postPaperSessionToOpener', () => {
    it('posts message to opener window', () => {
      const mockPostMessage = vi.fn();
      vi.stubGlobal('opener', { postMessage: mockPostMessage });

      postPaperSessionToOpener({
        did: 'did:plc:paper1',
        handle: 'paper.bsky.social',
        pdsEndpoint: 'https://bsky.social',
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: 'paper-oauth-callback',
          success: true,
          session: {
            did: 'did:plc:paper1',
            handle: 'paper.bsky.social',
            pdsEndpoint: 'https://bsky.social',
          },
        },
        'https://chive.pub'
      );
    });

    it('handles missing opener gracefully', () => {
      vi.stubGlobal('opener', null);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      expect(() =>
        postPaperSessionToOpener({
          did: 'did:plc:paper1',
          handle: 'paper.bsky.social',
          pdsEndpoint: 'https://bsky.social',
        })
      ).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('postPaperErrorToOpener', () => {
    it('posts error message to opener window', () => {
      const mockPostMessage = vi.fn();
      vi.stubGlobal('opener', { postMessage: mockPostMessage });

      postPaperErrorToOpener('Auth failed');

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: 'paper-oauth-callback',
          success: false,
          error: 'Auth failed',
        },
        'https://chive.pub'
      );
    });

    it('handles missing opener gracefully', () => {
      vi.stubGlobal('opener', null);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      expect(() => postPaperErrorToOpener('Auth failed')).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('PaperOAuthMessage type', () => {
    it('defines correct structure for success message', () => {
      const successMessage: PaperOAuthMessage = {
        type: 'paper-oauth-callback',
        success: true,
        session: {
          did: 'did:plc:paper1',
          handle: 'paper.bsky.social',
          pdsEndpoint: 'https://bsky.social',
        },
      };

      expect(successMessage.type).toBe('paper-oauth-callback');
      expect(successMessage.success).toBe(true);
      expect(successMessage.session?.did).toBe('did:plc:paper1');
    });

    it('defines correct structure for error message', () => {
      const errorMessage: PaperOAuthMessage = {
        type: 'paper-oauth-callback',
        success: false,
        error: 'Authentication failed',
      };

      expect(errorMessage.type).toBe('paper-oauth-callback');
      expect(errorMessage.success).toBe(false);
      expect(errorMessage.error).toBe('Authentication failed');
    });
  });
});
