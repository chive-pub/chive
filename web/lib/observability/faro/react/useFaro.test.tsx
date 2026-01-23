/**
 * Tests for useFaro hook.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock getFaro
const mockFaroApi = {
  pushEvent: vi.fn(),
  pushError: vi.fn(),
  pushLog: vi.fn(),
  setUser: vi.fn(),
  resetUser: vi.fn(),
  pushMeasurement: vi.fn(),
};

vi.mock('../initialize', () => ({
  getFaro: vi.fn(() => ({
    api: mockFaroApi,
  })),
}));

// Mock privacy module
vi.mock('../privacy', () => ({
  scrubObject: vi.fn((obj) => obj),
  scrubError: vi.fn((error) => ({ message: error.message, stack: error.stack })),
}));

import { useFaro } from './useFaro';

describe('useFaro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('faro instance', () => {
    it('returns faro instance when available', () => {
      const { result } = renderHook(() => useFaro());
      expect(result.current.faro).toBeDefined();
    });

    it('returns null when Faro is not initialized', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue(null);

      const { result } = renderHook(() => useFaro());
      expect(result.current.faro).toBeNull();
    });
  });

  describe('isAvailable', () => {
    it('returns true when Faro is initialized', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue({
        api: mockFaroApi,
      } as unknown as ReturnType<typeof getFaro>);

      const { result } = renderHook(() => useFaro());
      expect(result.current.isAvailable).toBe(true);
    });

    it('returns false when Faro is not available', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue(null);

      const { result } = renderHook(() => useFaro());
      expect(result.current.isAvailable).toBe(false);
    });
  });

  describe('pushEvent', () => {
    it('pushes event to Faro', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue({
        api: mockFaroApi,
      } as unknown as ReturnType<typeof getFaro>);

      const { result } = renderHook(() => useFaro());

      act(() => {
        result.current.pushEvent('test_event', { key: 'value' });
      });

      expect(mockFaroApi.pushEvent).toHaveBeenCalledWith('test_event', { key: 'value' });
    });

    it('does not throw when Faro is not available', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue(null);

      const { result } = renderHook(() => useFaro());

      expect(() => {
        act(() => {
          result.current.pushEvent('test_event');
        });
      }).not.toThrow();
    });
  });

  describe('pushError', () => {
    it('pushes error to Faro', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue({
        api: mockFaroApi,
      } as unknown as ReturnType<typeof getFaro>);

      const { result } = renderHook(() => useFaro());
      const error = new Error('Test error');

      act(() => {
        result.current.pushError(error, { component: 'TestComponent' });
      });

      expect(mockFaroApi.pushError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: { component: 'TestComponent' },
        })
      );
    });

    it('does not throw when Faro is not available', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue(null);

      const { result } = renderHook(() => useFaro());

      expect(() => {
        act(() => {
          result.current.pushError(new Error('Test'));
        });
      }).not.toThrow();
    });
  });

  describe('pushLog', () => {
    it('pushes log to Faro', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue({
        api: mockFaroApi,
      } as unknown as ReturnType<typeof getFaro>);

      const { result } = renderHook(() => useFaro());

      act(() => {
        result.current.pushLog('Test log message', 'info');
      });

      expect(mockFaroApi.pushLog).toHaveBeenCalled();
    });
  });

  describe('setUser', () => {
    it('sets user context in Faro', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue({
        api: mockFaroApi,
      } as unknown as ReturnType<typeof getFaro>);

      const { result } = renderHook(() => useFaro());

      act(() => {
        result.current.setUser({ id: 'user123', username: 'testuser' });
      });

      expect(mockFaroApi.setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
        })
      );
    });
  });

  describe('clearUser', () => {
    it('clears user context in Faro', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue({
        api: mockFaroApi,
      } as unknown as ReturnType<typeof getFaro>);

      const { result } = renderHook(() => useFaro());

      act(() => {
        result.current.clearUser();
      });

      expect(mockFaroApi.resetUser).toHaveBeenCalled();
    });
  });

  describe('pushMeasurement', () => {
    it('pushes measurement to Faro', async () => {
      const { getFaro } = await import('../initialize');
      vi.mocked(getFaro).mockReturnValue({
        api: mockFaroApi,
      } as unknown as ReturnType<typeof getFaro>);

      const { result } = renderHook(() => useFaro());

      act(() => {
        result.current.pushMeasurement('api_latency', { value: 150 });
      });

      expect(mockFaroApi.pushMeasurement).toHaveBeenCalledWith({
        type: 'api_latency',
        values: { value: 150 },
      });
    });
  });
});
