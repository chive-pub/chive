/**
 * Mock implementation of isolated-vm for unit tests.
 *
 * @remarks
 * The isolated-vm package is a native Node.js addon that requires compilation
 * for the specific platform. In CI and unit tests, we mock it to avoid
 * native dependency issues.
 *
 * @packageDocumentation
 */

import { vi } from 'vitest';

/**
 * Mock Reference class.
 */
export class Reference<T> {
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  async copy(): Promise<T> {
    return this.value;
  }

  async get(property: string): Promise<Reference<unknown>> {
    const obj = this.value as Record<string, unknown>;
    return new Reference(obj[property]);
  }

  async set(property: string, value: unknown): Promise<void> {
    const obj = this.value as Record<string, unknown>;
    obj[property] = value;
  }

  derefInto(): T {
    return this.value;
  }
}

/**
 * Mock ExternalCopy class.
 */
export class ExternalCopy<T> {
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  copyInto(_options?: { release?: boolean }): T {
    return this.value;
  }

  copy(): T {
    return this.value;
  }

  release(): void {
    // No-op
  }
}

/**
 * Mock Callback class.
 */
export class Callback {
  private fn: (...args: unknown[]) => unknown;

  constructor(fn: (...args: unknown[]) => unknown) {
    this.fn = fn;
  }

  call(...args: unknown[]): unknown {
    return this.fn(...args);
  }
}

/**
 * Mock Context class.
 */
class MockContext {
  private globals: Record<string, unknown> = {};

  get global(): Reference<Record<string, unknown>> {
    return new Reference(this.globals);
  }

  release(): void {
    // No-op
  }
}

/**
 * Mock Script class.
 */
class MockScript {
  private code: string;

  constructor(code: string) {
    this.code = code;
  }

  async run(_context: MockContext, _options?: { timeout?: number }): Promise<unknown> {
    // Simple evaluation for basic expressions
    // Note: This is intentionally limited for security
    try {
      // Only support simple numeric expressions for testing
      if (/^\d+$/.test(this.code.trim())) {
        return parseInt(this.code.trim(), 10);
      }
      // Return undefined for complex code - real tests should mock specific behavior
      return undefined;
    } catch {
      return undefined;
    }
  }
}

/**
 * Mock Isolate class.
 */
class MockIsolate {
  private disposed = false;

  constructor(_options?: { memoryLimit?: number }) {
    // Store options if needed
  }

  async createContext(): Promise<MockContext> {
    if (this.disposed) {
      throw new Error('Isolate has been disposed');
    }
    return new MockContext();
  }

  async compileScript(code: string): Promise<MockScript> {
    if (this.disposed) {
      throw new Error('Isolate has been disposed');
    }
    return new MockScript(code);
  }

  dispose(): void {
    this.disposed = true;
  }

  getHeapStatistics(): { used_heap_size: number; total_heap_size: number } {
    return {
      used_heap_size: 1024 * 1024, // 1MB
      total_heap_size: 128 * 1024 * 1024, // 128MB
    };
  }
}

/**
 * Default export mimicking the isolated-vm module structure.
 */
const isolatedVm = {
  Isolate: MockIsolate,
  Context: MockContext,
  Reference,
  ExternalCopy,
  Callback,
};

export default isolatedVm;
export { MockIsolate as Isolate, MockContext as Context };
