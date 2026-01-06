/**
 * Unit tests for ReconnectionManager.
 *
 * @remarks
 * Tests exponential backoff, jitter, retry logic, and reset functionality.
 */

import { describe, it, expect } from 'vitest';

import { ReconnectionManager } from '@/services/indexing/reconnection-manager.js';

describe('ReconnectionManager', () => {
  describe('constructor', () => {
    it('uses default options when not provided', () => {
      const manager = new ReconnectionManager();

      expect(manager.shouldRetry()).toBe(true);
      expect(manager.getAttempts()).toBe(0);
    });

    it('accepts custom options', () => {
      const manager = new ReconnectionManager({
        maxAttempts: 5,
        baseDelay: 500,
        maxDelay: 10000,
        enableJitter: false,
      });

      expect(manager.shouldRetry()).toBe(true);
      expect(manager.getAttempts()).toBe(0);
    });
  });

  describe('calculateDelay', () => {
    it('calculates exponential backoff correctly', () => {
      const manager = new ReconnectionManager({
        baseDelay: 1000,
        maxDelay: 30000,
        enableJitter: false,
      });

      // Attempt 0: 1s
      expect(manager.calculateDelay()).toBe(1000);

      // Attempt 1: 2s
      manager.recordAttempt();
      expect(manager.calculateDelay()).toBe(2000);

      // Attempt 2: 4s
      manager.recordAttempt();
      expect(manager.calculateDelay()).toBe(4000);

      // Attempt 3: 8s
      manager.recordAttempt();
      expect(manager.calculateDelay()).toBe(8000);

      // Attempt 4: 16s
      manager.recordAttempt();
      expect(manager.calculateDelay()).toBe(16000);

      // Attempt 5: 32s, but capped at 30s
      manager.recordAttempt();
      expect(manager.calculateDelay()).toBe(30000);
    });

    it('applies jitter when enabled', () => {
      const manager = new ReconnectionManager({
        baseDelay: 1000,
        maxDelay: 30000,
        enableJitter: true,
      });

      const delays = new Set<number>();

      // Calculate delay multiple times; should vary due to jitter
      for (let i = 0; i < 10; i++) {
        delays.add(manager.calculateDelay());
      }

      // With jitter, delays should vary (at least 2 unique values)
      expect(delays.size).toBeGreaterThanOrEqual(2);

      // All delays should be within ±25% of base (1000ms)
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(750); // 1000 minus 25%
        expect(delay).toBeLessThanOrEqual(1250); // 1000 + 25%
      }
    });

    it('does not apply jitter when disabled', () => {
      const manager = new ReconnectionManager({
        baseDelay: 1000,
        maxDelay: 30000,
        enableJitter: false,
      });

      const delays = new Set<number>();

      // Calculate delay multiple times; should be identical
      for (let i = 0; i < 10; i++) {
        delays.add(manager.calculateDelay());
      }

      // Without jitter, all delays should be identical
      expect(delays.size).toBe(1);
      expect([...delays][0]).toBe(1000);
    });

    it('respects max delay cap', () => {
      const manager = new ReconnectionManager({
        baseDelay: 1000,
        maxDelay: 5000,
        enableJitter: false,
      });

      // Attempt 10: would be 1024s without cap
      for (let i = 0; i < 10; i++) {
        manager.recordAttempt();
      }

      const delay = manager.calculateDelay();
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe('shouldRetry', () => {
    it('returns true when attempts are below max', () => {
      const manager = new ReconnectionManager({
        maxAttempts: 3,
      });

      expect(manager.shouldRetry()).toBe(true);

      manager.recordAttempt();
      expect(manager.shouldRetry()).toBe(true);

      manager.recordAttempt();
      expect(manager.shouldRetry()).toBe(true);

      manager.recordAttempt();
      expect(manager.shouldRetry()).toBe(false);
    });

    it('returns false when max attempts reached', () => {
      const manager = new ReconnectionManager({
        maxAttempts: 0,
      });

      expect(manager.shouldRetry()).toBe(false);
    });
  });

  describe('recordAttempt', () => {
    it('increments attempt counter', () => {
      const manager = new ReconnectionManager();

      expect(manager.getAttempts()).toBe(0);

      manager.recordAttempt();
      expect(manager.getAttempts()).toBe(1);

      manager.recordAttempt();
      expect(manager.getAttempts()).toBe(2);

      manager.recordAttempt();
      expect(manager.getAttempts()).toBe(3);
    });
  });

  describe('reset', () => {
    it('resets attempt counter to zero', () => {
      const manager = new ReconnectionManager();

      manager.recordAttempt();
      manager.recordAttempt();
      manager.recordAttempt();
      expect(manager.getAttempts()).toBe(3);

      manager.reset();
      expect(manager.getAttempts()).toBe(0);
    });

    it('allows retries after reset', () => {
      const manager = new ReconnectionManager({
        maxAttempts: 2,
      });

      manager.recordAttempt();
      manager.recordAttempt();
      expect(manager.shouldRetry()).toBe(false);

      manager.reset();
      expect(manager.shouldRetry()).toBe(true);
    });
  });

  describe('getAttempts', () => {
    it('returns current attempt count', () => {
      const manager = new ReconnectionManager();

      expect(manager.getAttempts()).toBe(0);

      for (let i = 1; i <= 5; i++) {
        manager.recordAttempt();
        expect(manager.getAttempts()).toBe(i);
      }
    });
  });

  describe('edge cases', () => {
    it('handles zero base delay', () => {
      const manager = new ReconnectionManager({
        baseDelay: 0,
        enableJitter: false,
      });

      expect(manager.calculateDelay()).toBe(0);
    });

    it('handles very large attempt counts', () => {
      const manager = new ReconnectionManager({
        baseDelay: 1000,
        maxDelay: 60000,
        enableJitter: false,
      });

      // Attempt 100: would overflow without cap
      for (let i = 0; i < 100; i++) {
        manager.recordAttempt();
      }

      const delay = manager.calculateDelay();
      expect(delay).toBe(60000); // Capped at maxDelay
      expect(Number.isFinite(delay)).toBe(true);
    });
  });
});
