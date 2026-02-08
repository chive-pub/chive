/**
 * Integration tests for Lexicon validation pipeline.
 *
 * @remarks
 * Tests the ATProto lexicon-based validation using @atproto/lexicon.
 * Validates that lexicons are properly generated and validation functions work correctly.
 *
 * @packageDocumentation
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { InvalidRequestError, InternalServerError } from '@atproto/xrpc-server';
import { describe, it, expect } from 'vitest';

import {
  lexicons,
  ids,
  validateXrpcParams,
  validateXrpcInput,
  validateXrpcOutput,
  safeValidateParams,
  hasMethod,
  getMethodType,
} from '@/api/xrpc/validation.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Lexicon Code Generation Pipeline', () => {
  // Skip shell-based tests - run `pnpm lexicons:generate` manually or in CI
  // These tests hang under vitest due to child process issues
  it.skip('generates lexicons successfully', async () => {
    const { stderr } = await execAsync('pnpm lexicons:generate', {
      cwd: path.join(__dirname, '../../..'),
      maxBuffer: 1024 * 1024 * 10,
    });
    expect(stderr).not.toContain('error');
  }, 180000);

  it('generates all expected type files', async () => {
    const typesDir = path.join(__dirname, '../../../src/lexicons/generated/types/pub/chive');

    const expectedDirs = [
      'eprint',
      'review',
      'graph',
      'actor',
      'claiming',
      'governance',
      'discovery',
      'author',
      'backlink',
      'activity',
      'metrics',
    ];

    for (const dir of expectedDirs) {
      const dirPath = path.join(typesDir, dir);
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    }
  });

  // Skip shell-based tests - run `pnpm typecheck` manually or in CI
  it.skip('generated TypeScript compiles without errors', async () => {
    const { stderr } = await execAsync('pnpm typecheck', {
      cwd: path.join(__dirname, '../../..'),
    });
    expect(stderr).not.toContain('error');
  }, 60000);

  it('lexicons instance is properly initialized', () => {
    expect(lexicons).toBeDefined();
    expect(typeof lexicons.assertValidXrpcParams).toBe('function');
    expect(typeof lexicons.assertValidXrpcInput).toBe('function');
    expect(typeof lexicons.assertValidXrpcOutput).toBe('function');
  });

  it('ids contains expected lexicon identifiers', () => {
    expect(ids).toBeDefined();
    expect(ids.PubChiveEprintSubmission).toBe('pub.chive.eprint.submission');
    expect(ids.PubChiveEprintGetSubmission).toBe('pub.chive.eprint.getSubmission');
    expect(ids.PubChiveReviewComment).toBe('pub.chive.review.comment');
    expect(ids.PubChiveGraphNode).toBe('pub.chive.graph.node');
  });
});

describe('Lexicon Validation Functions', () => {
  describe('validateXrpcParams', () => {
    it('accepts valid parameters', () => {
      expect(() => {
        validateXrpcParams('pub.chive.eprint.getSubmission', {
          uri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
        });
      }).not.toThrow();
    });

    it('throws InvalidRequestError for missing required parameters', () => {
      expect(() => {
        validateXrpcParams('pub.chive.eprint.getSubmission', {});
      }).toThrow(InvalidRequestError);
    });

    it('throws InvalidRequestError for invalid parameter types', () => {
      expect(() => {
        validateXrpcParams('pub.chive.eprint.getSubmission', { uri: 123 });
      }).toThrow(InvalidRequestError);
    });

    it('works with 3-arg form (explicit lexicons)', () => {
      expect(() => {
        validateXrpcParams(lexicons, 'pub.chive.eprint.getSubmission', {
          uri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
        });
      }).not.toThrow();
    });

    it('accepts valid search parameters with optional fields', () => {
      expect(() => {
        validateXrpcParams('pub.chive.eprint.searchSubmissions', {
          q: 'machine learning',
          limit: 10,
        });
      }).not.toThrow();
    });
  });

  describe('validateXrpcInput', () => {
    it('accepts valid input body', () => {
      expect(() => {
        validateXrpcInput('pub.chive.activity.log', {
          collection: 'pub.chive.eprint.submission',
          rkey: '3abc123def456',
          action: 'create',
          category: 'eprint_submit',
          targetUri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
        });
      }).not.toThrow();
    });

    it('throws InvalidRequestError for missing required fields', () => {
      expect(() => {
        validateXrpcInput('pub.chive.activity.log', {
          collection: 'pub.chive.eprint.submission',
          // Missing rkey, action, category
        });
      }).toThrow(InvalidRequestError);
    });

    it('accepts knownValues as hints (not strict validation)', () => {
      // knownValues in ATProto lexicons are documentation hints, not strict enums
      // Unknown values are allowed for forward compatibility
      expect(() => {
        validateXrpcInput('pub.chive.activity.log', {
          collection: 'pub.chive.eprint.submission',
          rkey: '3abc123def456',
          action: 'custom-action', // Not in knownValues but still valid
          category: 'eprint_submit',
        });
      }).not.toThrow();
    });
  });

  describe('validateXrpcOutput', () => {
    it('throws InternalServerError for invalid output', () => {
      expect(() => {
        validateXrpcOutput('pub.chive.eprint.getSubmission', {
          // Missing required fields
        });
      }).toThrow(InternalServerError);
    });
  });

  describe('safeValidateParams', () => {
    it('returns success for valid params', () => {
      const result = safeValidateParams('pub.chive.eprint.getSubmission', {
        uri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
      });
      expect(result.success).toBe(true);
    });

    it('returns error for invalid params', () => {
      const result = safeValidateParams('pub.chive.eprint.getSubmission', {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});

describe('Lexicon Method Utilities', () => {
  describe('hasMethod', () => {
    it('returns true for existing query methods', () => {
      expect(hasMethod('pub.chive.eprint.getSubmission')).toBe(true);
      expect(hasMethod('pub.chive.eprint.searchSubmissions')).toBe(true);
      expect(hasMethod('pub.chive.author.getProfile')).toBe(true);
    });

    it('returns true for existing procedure methods', () => {
      expect(hasMethod('pub.chive.activity.log')).toBe(true);
      expect(hasMethod('pub.chive.claiming.startClaim')).toBe(true);
    });

    it('returns false for non-existent methods', () => {
      expect(hasMethod('pub.chive.nonexistent.method')).toBe(false);
      expect(hasMethod('com.other.namespace')).toBe(false);
    });

    it('returns false for record types (not methods)', () => {
      // Record types are not methods (query/procedure)
      expect(hasMethod('pub.chive.eprint.submission')).toBe(false);
      expect(hasMethod('pub.chive.graph.node')).toBe(false);
    });
  });

  describe('getMethodType', () => {
    it('returns "query" for query methods', () => {
      expect(getMethodType('pub.chive.eprint.getSubmission')).toBe('query');
      expect(getMethodType('pub.chive.eprint.searchSubmissions')).toBe('query');
    });

    it('returns "procedure" for procedure methods', () => {
      expect(getMethodType('pub.chive.activity.log')).toBe('procedure');
      expect(getMethodType('pub.chive.claiming.startClaim')).toBe('procedure');
    });

    it('returns undefined for non-existent methods', () => {
      expect(getMethodType('pub.chive.nonexistent.method')).toBeUndefined();
    });

    it('returns undefined for record types', () => {
      expect(getMethodType('pub.chive.eprint.submission')).toBeUndefined();
    });
  });
});

describe('Generated Types Quality', () => {
  it('generated files include proper exports', async () => {
    const submissionFile = path.join(
      __dirname,
      '../../../src/lexicons/generated/types/pub/chive/eprint/submission.ts'
    );
    const content = await fs.readFile(submissionFile, 'utf-8');

    // Should export type definitions
    expect(content).toContain('export');
    expect(content).toContain('Record');
  });

  it('lexicons.ts exports required items', async () => {
    const lexiconsFile = path.join(__dirname, '../../../src/lexicons/generated/lexicons.ts');
    const content = await fs.readFile(lexiconsFile, 'utf-8');

    expect(content).toContain('export const lexicons');
    expect(content).toContain('export const ids');
  });
});
