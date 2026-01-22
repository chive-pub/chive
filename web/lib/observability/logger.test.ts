/**
 * Tests for the browser logger.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { BrowserLogger, createLogger, logger, getLogBuffer, clearLogBuffer } from './logger';

describe('BrowserLogger', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    clearLogBuffer();
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('creates a logger instance', () => {
      const log = createLogger();
      expect(log).toBeInstanceOf(BrowserLogger);
    });

    it('creates logger with custom options', () => {
      const log = createLogger({
        level: 'warn',
        context: { component: 'test' },
        service: 'test-service',
      });
      expect(log).toBeInstanceOf(BrowserLogger);
    });
  });

  describe('default logger', () => {
    it('is exported and is a BrowserLogger instance', () => {
      expect(logger).toBeInstanceOf(BrowserLogger);
    });
  });

  describe('log levels', () => {
    it('logs debug messages', () => {
      const log = createLogger({ level: 'debug' });
      log.debug('debug message');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('logs info messages', () => {
      const log = createLogger({ level: 'debug' });
      log.info('info message');
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('logs warn messages', () => {
      const log = createLogger({ level: 'debug' });
      log.warn('warn message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('logs error messages', () => {
      const log = createLogger({ level: 'debug' });
      log.error('error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('respects log level - debug level logs everything', () => {
      const log = createLogger({ level: 'debug' });
      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');

      expect(getLogBuffer()).toHaveLength(4);
    });

    it('respects log level - warn level skips debug and info', () => {
      const log = createLogger({ level: 'warn' });
      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');

      expect(getLogBuffer()).toHaveLength(2);
      expect(getLogBuffer().map((e) => e.level)).toEqual(['warn', 'error']);
    });

    it('respects log level - error level only logs errors', () => {
      const log = createLogger({ level: 'error' });
      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');

      expect(getLogBuffer()).toHaveLength(1);
      expect(getLogBuffer()[0]?.level).toBe('error');
    });
  });

  describe('context', () => {
    it('includes base context in log entries', () => {
      const log = createLogger({ level: 'debug', context: { component: 'test-component' } });
      log.info('test message');

      const entry = getLogBuffer()[0];
      expect(entry?.component).toBe('test-component');
    });

    it('includes additional context passed to log methods', () => {
      const log = createLogger({ level: 'debug' });
      log.info('test message', { requestId: 'req_123', customField: 'value' });

      const entry = getLogBuffer()[0];
      expect(entry?.requestId).toBe('req_123');
      expect(entry?.customField).toBe('value');
    });

    it('merges base and method context', () => {
      const log = createLogger({
        level: 'debug',
        context: { component: 'test', baseField: 'base' },
      });
      log.info('test message', { methodField: 'method' });

      const entry = getLogBuffer()[0];
      expect(entry?.component).toBe('test');
      expect(entry?.baseField).toBe('base');
      expect(entry?.methodField).toBe('method');
    });
  });

  describe('child logger', () => {
    it('creates child logger with additional context', () => {
      const parentLog = createLogger({ level: 'debug', context: { component: 'parent' } });
      const childLog = parentLog.child({ requestId: 'req_123' });

      childLog.info('child message');

      const entry = getLogBuffer()[0];
      expect(entry?.component).toBe('parent');
      expect(entry?.requestId).toBe('req_123');
    });

    it('child logger inherits parent log level', () => {
      const parentLog = createLogger({ level: 'warn' });
      const childLog = parentLog.child({ requestId: 'req_123' });

      childLog.debug('debug message'); // Should be skipped
      childLog.warn('warn message');

      expect(getLogBuffer()).toHaveLength(1);
      expect(getLogBuffer()[0]?.level).toBe('warn');
    });

    it('child logger does not modify parent', () => {
      const parentLog = createLogger({ level: 'debug', context: { component: 'parent' } });
      const childLog = parentLog.child({ childField: 'child' });

      parentLog.info('parent message');
      childLog.info('child message');

      expect(getLogBuffer()[0]?.childField).toBeUndefined();
      expect(getLogBuffer()[1]?.childField).toBe('child');
    });
  });

  describe('error logging', () => {
    it('logs error with Error object', () => {
      const log = createLogger({ level: 'debug' });
      const error = new Error('test error');
      log.error('error occurred', error);

      const entry = getLogBuffer()[0];
      expect(entry?.err).toBeDefined();
      expect((entry?.err as { message: string }).message).toBe('test error');
      expect((entry?.err as { type: string }).type).toBe('Error');
      expect((entry?.err as { stack: string }).stack).toBeDefined();
    });

    it('logs error with custom error properties', () => {
      const log = createLogger({ level: 'debug' });
      const error = new Error('API error') as Error & { code: string; statusCode: number };
      error.code = 'API_ERROR';
      error.statusCode = 500;
      log.error('API failed', error);

      const entry = getLogBuffer()[0];
      expect((entry?.err as { code: string }).code).toBe('API_ERROR');
      expect((entry?.err as { statusCode: number }).statusCode).toBe(500);
    });

    it('handles non-Error error values', () => {
      const log = createLogger({ level: 'debug' });
      log.error('error occurred', 'string error');

      const entry = getLogBuffer()[0];
      expect(entry?.err).toBeDefined();
      expect((entry?.err as { message: string }).message).toBe('string error');
    });

    it('handles undefined error', () => {
      const log = createLogger({ level: 'debug' });
      log.error('error occurred', undefined, { context: 'test' });

      const entry = getLogBuffer()[0];
      expect(entry?.err).toBeUndefined();
      expect(entry?.context).toBe('test');
    });
  });

  describe('sensitive data redaction', () => {
    it('redacts password fields', () => {
      const log = createLogger({ level: 'debug' });
      log.info('user login', { username: 'testuser', password: 'secret123' });

      const entry = getLogBuffer()[0];
      expect(entry?.username).toBe('testuser');
      expect(entry?.password).toBe('[REDACTED]');
    });

    it('redacts token fields', () => {
      const log = createLogger({ level: 'debug' });
      log.info('auth', { accessToken: 'abc123', refreshToken: 'def456' });

      const entry = getLogBuffer()[0];
      expect(entry?.accessToken).toBe('[REDACTED]');
      expect(entry?.refreshToken).toBe('[REDACTED]');
    });

    it('redacts authorization header', () => {
      const log = createLogger({ level: 'debug' });
      log.info('request', { authorization: 'Bearer xyz', method: 'GET' });

      const entry = getLogBuffer()[0];
      expect(entry?.authorization).toBe('[REDACTED]');
      expect(entry?.method).toBe('GET');
    });

    it('redacts nested sensitive fields', () => {
      const log = createLogger({ level: 'debug' });
      log.info('nested', {
        user: {
          name: 'test',
          apiKey: 'secret',
        },
      });

      const entry = getLogBuffer()[0];
      expect((entry?.user as { name: string }).name).toBe('test');
      expect((entry?.user as { apiKey: string }).apiKey).toBe('[REDACTED]');
    });

    it('redacts sensitive fields in base context', () => {
      const log = createLogger({
        level: 'debug',
        context: { jwt: 'secret-jwt-token', component: 'auth' },
      });
      log.info('test');

      const entry = getLogBuffer()[0];
      expect(entry?.jwt).toBe('[REDACTED]');
      expect(entry?.component).toBe('auth');
    });
  });

  describe('log entry structure', () => {
    it('includes required fields', () => {
      const log = createLogger({ level: 'debug', service: 'test-service' });
      log.info('test message');

      const entry = getLogBuffer()[0];
      expect(entry?.level).toBe('info');
      expect(entry?.msg).toBe('test message');
      expect(entry?.time).toBeDefined();
      expect(entry?.service).toBe('test-service');
      expect(entry?.environment).toBeDefined();
      expect(entry?.version).toBeDefined();
    });

    it('uses ISO timestamp format', () => {
      const log = createLogger({ level: 'debug' });
      log.info('test');

      const entry = getLogBuffer()[0];
      expect(entry?.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('log buffer', () => {
    it('stores log entries', () => {
      const log = createLogger({ level: 'debug' });
      log.info('message 1');
      log.info('message 2');

      expect(getLogBuffer()).toHaveLength(2);
    });

    it('clearLogBuffer removes all entries', () => {
      const log = createLogger({ level: 'debug' });
      log.info('message 1');
      log.info('message 2');
      clearLogBuffer();

      expect(getLogBuffer()).toHaveLength(0);
    });

    it('limits buffer size', () => {
      const log = createLogger({ level: 'debug' });

      // Log more than buffer max size (100)
      for (let i = 0; i < 150; i++) {
        log.info(`message ${i}`);
      }

      expect(getLogBuffer()).toHaveLength(100);
      // Should have the most recent entries
      expect(getLogBuffer()[0]?.msg).toBe('message 50');
      expect(getLogBuffer()[99]?.msg).toBe('message 149');
    });
  });
});
