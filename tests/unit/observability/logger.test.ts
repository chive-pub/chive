/**
 * Unit tests for PinoLogger.
 *
 * @remarks
 * Tests the PinoLogger implementation of ILogger interface.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { PinoLogger, createLogger } from '../../../src/observability/logger.js';

describe('PinoLogger', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleOutput: string[] = [];
  let originalStdoutWrite: typeof process.stdout.write;

  beforeEach(() => {
    originalEnv = { ...process.env };
    consoleOutput = [];

    // Capture stdout output
    originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      consoleOutput.push(chunk.toString());
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.env = originalEnv;
    process.stdout.write = originalStdoutWrite;
  });

  describe('constructor', () => {
    it('creates logger with default options', () => {
      const logger = new PinoLogger();
      expect(logger).toBeInstanceOf(PinoLogger);
    });

    it('creates logger with custom options', () => {
      const logger = new PinoLogger({
        level: 'debug',
        service: 'test-service',
        environment: 'test',
        version: '1.0.0',
      });
      expect(logger).toBeInstanceOf(PinoLogger);
    });

    it('reads level from LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'debug';
      const logger = new PinoLogger();
      expect(logger).toBeInstanceOf(PinoLogger);
    });

    it('reads service name from OTEL_SERVICE_NAME environment variable', () => {
      process.env.OTEL_SERVICE_NAME = 'env-service';
      const logger = new PinoLogger();
      expect(logger).toBeInstanceOf(PinoLogger);
    });
  });

  describe('ILogger interface', () => {
    it('implements debug method', () => {
      const logger = new PinoLogger({ level: 'debug' });
      expect(typeof logger.debug).toBe('function');
    });

    it('implements info method', () => {
      const logger = new PinoLogger();
      expect(typeof logger.info).toBe('function');
    });

    it('implements warn method', () => {
      const logger = new PinoLogger();
      expect(typeof logger.warn).toBe('function');
    });

    it('implements error method', () => {
      const logger = new PinoLogger();
      expect(typeof logger.error).toBe('function');
    });

    it('implements child method', () => {
      const logger = new PinoLogger();
      expect(typeof logger.child).toBe('function');
    });

    it('child returns ILogger', () => {
      const logger = new PinoLogger();
      const child = logger.child({ requestId: '123' });
      expect(typeof child.info).toBe('function');
      expect(typeof child.child).toBe('function');
    });
  });

  describe('logging methods', () => {
    it('logs info message without context', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('Test message');
      expect(consoleOutput.length).toBeGreaterThan(0);
    });

    it('logs info message with context', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('Test message', { key: 'value' });
      expect(consoleOutput.length).toBeGreaterThan(0);
    });

    it('logs debug message when level is debug', () => {
      const logger = new PinoLogger({ level: 'debug' });
      logger.debug('Debug message');
      expect(consoleOutput.length).toBeGreaterThan(0);
    });

    it('logs warn message', () => {
      const logger = new PinoLogger({ level: 'warn' });
      logger.warn('Warning message');
      expect(consoleOutput.length).toBeGreaterThan(0);
    });

    it('logs error message without error object', () => {
      const logger = new PinoLogger({ level: 'error' });
      logger.error('Error message');
      expect(consoleOutput.length).toBeGreaterThan(0);
    });

    it('logs error message with error object', () => {
      const logger = new PinoLogger({ level: 'error' });
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      expect(consoleOutput.length).toBeGreaterThan(0);
    });

    it('logs error message with error and context', () => {
      const logger = new PinoLogger({ level: 'error' });
      const error = new Error('Test error');
      logger.error('Error occurred', error, { operation: 'test' });
      expect(consoleOutput.length).toBeGreaterThan(0);
    });
  });

  describe('child logger', () => {
    it('creates child logger with merged context', () => {
      const logger = new PinoLogger({ level: 'info' });
      const child = logger.child({ requestId: 'req_123' });
      child.info('Child message');
      expect(consoleOutput.length).toBeGreaterThan(0);
    });

    it('supports nested child loggers', () => {
      const logger = new PinoLogger({ level: 'info' });
      const child1 = logger.child({ requestId: 'req_123' });
      const child2 = child1.child({ userId: 'user_456' });
      child2.info('Nested child message');
      expect(consoleOutput.length).toBeGreaterThan(0);
    });
  });

  describe('sensitive data redaction', () => {
    it('redacts password field', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('Login attempt', { username: 'alice', password: 'secret123' });

      const output = consoleOutput.join('');
      expect(output).not.toContain('secret123');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts token field', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('Auth', { token: 'jwt_abc123' });

      const output = consoleOutput.join('');
      expect(output).not.toContain('jwt_abc123');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts apiKey field', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('API call', { apiKey: 'sk_live_xyz' });

      const output = consoleOutput.join('');
      expect(output).not.toContain('sk_live_xyz');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts authorization field', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('Request', { authorization: 'Bearer abc' });

      const output = consoleOutput.join('');
      expect(output).not.toContain('Bearer abc');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts accessToken field', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('OAuth', { accessToken: 'access_xyz' });

      const output = consoleOutput.join('');
      expect(output).not.toContain('access_xyz');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts nested sensitive fields', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('Nested', {
        user: {
          name: 'alice',
          credentials: {
            password: 'nested_secret',
          },
        },
      });

      const output = consoleOutput.join('');
      expect(output).not.toContain('nested_secret');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts sensitive fields in child logger context', () => {
      const logger = new PinoLogger({ level: 'info' });
      const child = logger.child({ token: 'child_token' });
      child.info('Child log');

      const output = consoleOutput.join('');
      expect(output).not.toContain('child_token');
      expect(output).toContain('[REDACTED]');
    });

    it('preserves non-sensitive fields', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('Safe log', { username: 'alice', email: 'alice@example.com' });

      const output = consoleOutput.join('');
      expect(output).toContain('alice');
      expect(output).toContain('alice@example.com');
    });
  });

  describe('createLogger factory', () => {
    it('creates PinoLogger instance', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('accepts options', () => {
      const logger = createLogger({ level: 'debug', service: 'test' });
      expect(logger).toBeDefined();
    });
  });

  describe('JSON output format', () => {
    it('outputs valid JSON', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('JSON test');

      expect(consoleOutput.length).toBeGreaterThan(0);
      const parsed = JSON.parse(consoleOutput[0] ?? '{}') as Record<string, unknown>;
      expect(parsed).toHaveProperty('level');
      expect(parsed).toHaveProperty('msg');
    });

    it('includes service field', () => {
      const logger = new PinoLogger({ level: 'info', service: 'test-service' });
      logger.info('Service test');

      const parsed = JSON.parse(consoleOutput[0] ?? '{}') as Record<string, unknown>;
      expect(parsed.service).toBe('test-service');
    });

    it('includes environment field', () => {
      const logger = new PinoLogger({ level: 'info', environment: 'test' });
      logger.info('Environment test');

      const parsed = JSON.parse(consoleOutput[0] ?? '{}') as Record<string, unknown>;
      expect(parsed.environment).toBe('test');
    });

    it('includes version field', () => {
      const logger = new PinoLogger({ level: 'info', version: '1.2.3' });
      logger.info('Version test');

      const parsed = JSON.parse(consoleOutput[0] ?? '{}') as Record<string, unknown>;
      expect(parsed.version).toBe('1.2.3');
    });

    it('includes timestamp', () => {
      const logger = new PinoLogger({ level: 'info' });
      logger.info('Timestamp test');

      const parsed = JSON.parse(consoleOutput[0] ?? '{}') as Record<string, unknown>;
      expect(parsed.time).toBeDefined();
    });
  });
});
