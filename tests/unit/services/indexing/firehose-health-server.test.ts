/**
 * Tests for the firehose health evaluation logic.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

import { ConnectionState } from '../../../../src/services/indexing/firehose-consumer.js';
import { evaluateFirehoseHealth } from '../../../../src/services/indexing/firehose-health-server.js';
import type {
  IndexingHealth,
  RelayHealth,
} from '../../../../src/services/indexing/indexing-service.js';

const NOW = 1_000_000_000_000;
const GRACE = 300_000; // 5 minutes

function relay(overrides: Partial<RelayHealth>): RelayHealth {
  return {
    relay: 'bsky',
    state: ConnectionState.CONNECTED,
    connected: true,
    lastConnectedAt: NOW,
    lastEventAt: NOW,
    ...overrides,
  };
}

function health(overrides: Partial<IndexingHealth>): IndexingHealth {
  return {
    running: true,
    startedAt: new Date(NOW),
    relays: [relay({})],
    ...overrides,
  };
}

describe('evaluateFirehoseHealth', () => {
  it('is healthy when the relay is connected', () => {
    expect(evaluateFirehoseHealth(health({}), GRACE, NOW).healthy).toBe(true);
  });

  it('is unhealthy when the service is not running', () => {
    const result = evaluateFirehoseHealth(health({ running: false }), GRACE, NOW);
    expect(result.healthy).toBe(false);
    expect(result.reason).toMatch(/not running/);
  });

  it('is unhealthy when no relays are configured', () => {
    const result = evaluateFirehoseHealth(health({ relays: [] }), GRACE, NOW);
    expect(result.healthy).toBe(false);
    expect(result.reason).toMatch(/no relays/);
  });

  it('tolerates a brief disconnect within the grace window', () => {
    const recent = relay({
      connected: false,
      state: ConnectionState.DISCONNECTED,
      lastConnectedAt: NOW - (GRACE - 1),
    });
    expect(evaluateFirehoseHealth(health({ relays: [recent] }), GRACE, NOW).healthy).toBe(true);
  });

  it('is unhealthy once a disconnect exceeds the grace window', () => {
    const stale = relay({
      connected: false,
      state: ConnectionState.DISCONNECTED,
      lastConnectedAt: NOW - (GRACE + 1),
    });
    const result = evaluateFirehoseHealth(health({ relays: [stale] }), GRACE, NOW);
    expect(result.healthy).toBe(false);
    expect(result.reason).toMatch(/bsky/);
  });

  it('is unhealthy when a relay has never connected', () => {
    const never = relay({
      connected: false,
      state: ConnectionState.CONNECTING,
      lastConnectedAt: null,
    });
    const result = evaluateFirehoseHealth(health({ relays: [never] }), GRACE, NOW);
    expect(result.healthy).toBe(false);
    expect(result.reason).toMatch(/never connected/);
  });

  it('is unhealthy when any one of several relays is down', () => {
    const result = evaluateFirehoseHealth(
      health({
        relays: [
          relay({ relay: 'a' }),
          relay({ relay: 'b', connected: false, lastConnectedAt: NOW - (GRACE + 5000) }),
        ],
      }),
      GRACE,
      NOW
    );
    expect(result.healthy).toBe(false);
    expect(result.reason).toMatch(/b/);
  });
});
