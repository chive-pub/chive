/**
 * Tests for FirehoseConsumer reconnection and liveness behavior.
 *
 * @remarks
 * Focuses on the regression that previously wedged production: a single failed
 * reconnection attempt permanently stopped the consumer. The reconnect loop
 * must keep retrying with backoff until it reconnects.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Self-contained WebSocket mock (no EventEmitter import: vi.hoisted runs before
// module imports). Each constructed socket is pushed to `sockets` so the test
// can drive open/close/error events and assert reconnection.
const wsMock = vi.hoisted(() => {
  class MockSocket {
    public readonly url: string;
    public terminateCount = 0;
    public pingCount = 0;
    private readonly listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

    constructor(url: string) {
      this.url = url;
      MockSocket.instances.push(this);
    }

    static instances: MockSocket[] = [];

    on(event: string, cb: (...args: unknown[]) => void): this {
      (this.listeners[event] ??= []).push(cb);
      return this;
    }

    once(event: string, cb: (...args: unknown[]) => void): this {
      const wrapper = (...args: unknown[]): void => {
        this.off(event, wrapper);
        cb(...args);
      };
      return this.on(event, wrapper);
    }

    off(event: string, cb: (...args: unknown[]) => void): this {
      this.listeners[event] = (this.listeners[event] ?? []).filter((f) => f !== cb);
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      for (const cb of (this.listeners[event] ?? []).slice()) {
        cb(...args);
      }
    }

    ping(): void {
      this.pingCount += 1;
    }

    terminate(): void {
      this.terminateCount += 1;
      this.emit('close');
    }

    close(): void {
      this.emit('close');
    }
  }
  return { MockSocket };
});

vi.mock('ws', () => ({ default: wsMock.MockSocket }));

import type { CursorManager } from '../../../../src/services/indexing/cursor-manager.js';
import {
  ConnectionState,
  FirehoseConsumer,
} from '../../../../src/services/indexing/firehose-consumer.js';
import { ReconnectionManager } from '../../../../src/services/indexing/reconnection-manager.js';

function createCursorManager(): CursorManager {
  return {
    getCurrentCursor: vi.fn().mockResolvedValue(null),
    updateCursor: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    getPendingCursor: vi.fn().mockReturnValue(null),
  } as unknown as CursorManager;
}

function makeConsumer(heartbeatIntervalMs = 0): FirehoseConsumer {
  return new FirehoseConsumer({
    cursorManager: createCursorManager(),
    // Fixed tiny delay, no jitter, so fake timers advance deterministically.
    reconnectionManager: new ReconnectionManager({
      maxAttempts: 100,
      baseDelay: 10,
      maxDelay: 10,
      enableJitter: false,
    }),
    heartbeatIntervalMs,
  });
}

/** Flush pending microtasks. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/** Returns the constructed socket at the given index, asserting it exists. */
function socketAt(index: number): InstanceType<typeof wsMock.MockSocket> {
  const socket = wsMock.MockSocket.instances[index];
  if (!socket) {
    throw new Error(`expected a socket at index ${index}`);
  }
  return socket;
}

describe('FirehoseConsumer reconnection', () => {
  beforeEach(() => {
    wsMock.MockSocket.instances.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('keeps retrying after a failed reconnection attempt', async () => {
    const consumer = makeConsumer();
    const sockets = wsMock.MockSocket.instances;

    // Begin consuming: connect() creates the first socket.
    const iterator = consumer.subscribe({ relay: 'wss://relay.test' })[Symbol.asyncIterator]();
    void iterator.next();
    await flush();
    expect(sockets).toHaveLength(1);

    // First connection opens successfully.
    socketAt(0).emit('open');
    await flush();
    expect(consumer.getHealth().connected).toBe(true);

    // Connection drops -> schedules a reconnect.
    socketAt(0).emit('close');
    await flush();

    // After the backoff delay, the consumer reconnects (socket #2)...
    await vi.advanceTimersByTimeAsync(10);
    expect(sockets).toHaveLength(2);

    // ...but that reconnect FAILS before opening (the exact case that used to
    // permanently wedge the consumer).
    socketAt(1).emit('error', new Error('Unexpected server response: 503'));
    await flush();

    // The fix: it must schedule ANOTHER attempt rather than give up.
    await vi.advanceTimersByTimeAsync(10);
    expect(sockets).toHaveLength(3);

    // The next attempt succeeds and the consumer is healthy again.
    socketAt(2).emit('open');
    await flush();
    expect(consumer.getHealth().connected).toBe(true);
    expect(consumer.getState()).toBe(ConnectionState.CONNECTED);

    await consumer.disconnect();
  });

  it('does not reconnect after a graceful disconnect', async () => {
    const consumer = makeConsumer();
    const sockets = wsMock.MockSocket.instances;

    const iterator = consumer.subscribe({ relay: 'wss://relay.test' })[Symbol.asyncIterator]();
    void iterator.next();
    await flush();
    socketAt(0).emit('open');
    await flush();

    await consumer.disconnect();
    socketAt(0).emit('close');
    await flush();
    await vi.advanceTimersByTimeAsync(100);

    // No new socket: a graceful disconnect must not reconnect.
    expect(sockets).toHaveLength(1);
    expect(consumer.getHealth().connected).toBe(false);
  });

  it('terminates a half-open connection when the heartbeat gets no pong', async () => {
    const consumer = makeConsumer(50);

    const iterator = consumer.subscribe({ relay: 'wss://relay.test' })[Symbol.asyncIterator]();
    void iterator.next();
    await flush();
    socketAt(0).emit('open');
    await flush();

    // First heartbeat tick: isAlive was true (just opened) -> sends a ping.
    await vi.advanceTimersByTimeAsync(50);
    expect(socketAt(0).pingCount).toBe(1);

    // No pong arrives. Next tick: isAlive is false -> terminate the socket.
    await vi.advanceTimersByTimeAsync(50);
    expect(socketAt(0).terminateCount).toBe(1);

    await consumer.disconnect();
  });
});
