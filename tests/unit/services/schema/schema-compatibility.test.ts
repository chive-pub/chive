/**
 * Unit tests for SchemaCompatibilityService.
 *
 * @remarks
 * Tests schema evolution detection and migration hint generation.
 */

import { describe, expect, it } from 'vitest';

import { SchemaCompatibilityService } from '../../../../src/services/schema/schema-compatibility.js';
import {
  CURRENT_EPRINT_SCHEMA_VERSION,
  formatSchemaVersion,
  parseSchemaVersion,
  compareSchemaVersions,
} from '../../../../src/types/schema-compatibility.js';

describe('SchemaCompatibilityService', () => {
  const service = new SchemaCompatibilityService();

  describe('detectAbstractFormat', () => {
    it('detects legacy string format', () => {
      const testString = 'This is a plain text abstract.';
      const result = service.detectAbstractFormat(testString);

      expect(result.field).toBe('abstract');
      expect(result.format).toBe('string');
      expect(result.isCurrent).toBe(false);
      expect(result.metadata).toHaveProperty('length', testString.length);
      expect(result.metadata).toHaveProperty('detectedVersion', '0.0.0');
    });

    it('detects current rich text array format', () => {
      const richTextAbstract = [
        { type: 'text', content: 'This is a ' },
        { type: 'nodeRef', uri: 'at://did:plc:123/pub.chive.graph.node/field1', label: 'field' },
        { type: 'text', content: ' abstract.' },
      ];

      const result = service.detectAbstractFormat(richTextAbstract);

      expect(result.field).toBe('abstract');
      expect(result.format).toBe('rich-text-array');
      expect(result.isCurrent).toBe(true);
      expect(result.metadata).toHaveProperty('itemCount', 3);
      expect(result.metadata).toHaveProperty('isValid', true);
    });

    it('detects empty array as current format', () => {
      const result = service.detectAbstractFormat([]);

      expect(result.format).toBe('rich-text-array');
      expect(result.isCurrent).toBe(true);
    });

    it('detects missing abstract as empty', () => {
      const result = service.detectAbstractFormat(undefined);

      expect(result.format).toBe('empty');
      expect(result.isCurrent).toBe(true);
    });

    it('detects null abstract as empty', () => {
      const result = service.detectAbstractFormat(null);

      expect(result.format).toBe('empty');
      expect(result.isCurrent).toBe(true);
    });

    it('detects invalid format', () => {
      const result = service.detectAbstractFormat({ invalid: 'object' });

      expect(result.format).toBe('invalid');
      expect(result.isCurrent).toBe(false);
      expect(result.metadata).toHaveProperty('actualType', 'object');
      expect(result.metadata).toHaveProperty('reason', 'unexpected-type');
    });

    it('validates rich text array items', () => {
      // Valid array with text only
      const textOnly = [{ type: 'text', content: 'Hello' }];
      expect(service.detectAbstractFormat(textOnly).isCurrent).toBe(true);

      // Valid array with nodeRef
      const withNodeRef = [{ type: 'nodeRef', uri: 'at://did:plc:123/collection/key' }];
      expect(service.detectAbstractFormat(withNodeRef).isCurrent).toBe(true);

      // Valid array with mixed items
      const mixed = [
        { type: 'text', content: 'Hello ' },
        { type: 'nodeRef', uri: 'at://did:plc:123/collection/key', label: 'world' },
      ];
      expect(service.detectAbstractFormat(mixed).isCurrent).toBe(true);

      // Invalid: missing type
      const missingType = [{ content: 'Hello' }];
      expect(service.detectAbstractFormat(missingType).isCurrent).toBe(false);

      // Invalid: nodeRef without uri
      const nodeRefNoUri = [{ type: 'nodeRef', label: 'test' }];
      expect(service.detectAbstractFormat(nodeRefNoUri).isCurrent).toBe(false);
    });
  });

  describe('analyzeEprintRecord', () => {
    it('detects legacy record with string abstract', () => {
      const legacyRecord = {
        title: 'Test Paper',
        abstract: 'Plain text abstract',
      };

      const result = service.analyzeEprintRecord(legacyRecord);

      expect(result.isCurrentSchema).toBe(false);
      expect(result.compatibility.detectedFormat).toBe('legacy');
      expect(result.compatibility.schemaVersion).toEqual({ major: 0, minor: 0, patch: 0 });
      expect(result.compatibility.deprecatedFields).toHaveLength(1);
      expect(result.compatibility.deprecatedFields[0]?.field).toBe('abstract');
      expect(result.compatibility.migrationAvailable).toBe(true);
      expect(result.compatibility.migrationHints).toHaveLength(1);
    });

    it('provides detailed deprecation info for string abstract', () => {
      const legacyRecord = {
        title: 'Test Paper',
        abstract: 'Plain text abstract',
      };

      const result = service.analyzeEprintRecord(legacyRecord);
      const deprecatedField = result.compatibility.deprecatedFields[0];

      expect(deprecatedField).toBeDefined();
      expect(deprecatedField?.field).toBe('abstract');
      expect(deprecatedField?.detectedFormat).toBe('string');
      expect(deprecatedField?.currentFormat).toBe('RichTextItem[]');
      expect(deprecatedField?.deprecatedSince).toBe('0.1.0');
      expect(deprecatedField?.description).toContain('rich text');
    });

    it('provides migration hint with example for string abstract', () => {
      const legacyRecord = {
        title: 'Test Paper',
        abstract: 'Plain text abstract',
      };

      const result = service.analyzeEprintRecord(legacyRecord);
      const migrationHint = result.compatibility.migrationHints?.[0];

      expect(migrationHint).toBeDefined();
      expect(migrationHint?.field).toBe('abstract');
      expect(migrationHint?.action).toBe('convert');
      expect(migrationHint?.instructions).toContain('Convert');
      expect(migrationHint?.documentationUrl).toContain('abstract-richtext');
      expect(migrationHint?.example).toEqual([
        { type: 'text', content: 'Example abstract text with rich formatting support.' },
      ]);
    });

    it('accepts current record with array abstract', () => {
      const currentRecord = {
        title: 'Test Paper',
        abstract: [{ type: 'text', content: 'Rich text abstract' }],
      };

      const result = service.analyzeEprintRecord(currentRecord);

      expect(result.isCurrentSchema).toBe(true);
      expect(result.compatibility.detectedFormat).toBe('current');
      expect(result.compatibility.deprecatedFields).toHaveLength(0);
      expect(result.compatibility.migrationAvailable).toBe(false);
    });

    it('detects invalid abstract format', () => {
      const invalidRecord = {
        title: 'Test Paper',
        abstract: { invalid: 'object' },
      };

      const result = service.analyzeEprintRecord(invalidRecord);

      expect(result.isCurrentSchema).toBe(false);
      expect(result.compatibility.deprecatedFields).toHaveLength(1);
      expect(result.compatibility.deprecatedFields[0]?.detectedFormat).toBe('object');
      expect(result.compatibility.deprecatedFields[0]?.deprecatedSince).toBe('0.0.0');
    });

    it('provides restructure hint for invalid abstract', () => {
      const invalidRecord = {
        title: 'Test Paper',
        abstract: { invalid: 'object' },
      };

      const result = service.analyzeEprintRecord(invalidRecord);
      const migrationHint = result.compatibility.migrationHints?.[0];

      expect(migrationHint).toBeDefined();
      expect(migrationHint?.action).toBe('restructure');
      expect(migrationHint?.instructions).toContain('invalid format');
    });

    it('handles invalid record structure', () => {
      const result = service.analyzeEprintRecord('not an object');

      expect(result.isCurrentSchema).toBe(false);
      expect(result.compatibility.detectedFormat).toBe('unknown');
    });

    it('handles null record', () => {
      const result = service.analyzeEprintRecord(null);

      expect(result.isCurrentSchema).toBe(false);
      expect(result.compatibility.detectedFormat).toBe('unknown');
    });

    it('accepts record with empty abstract', () => {
      const recordWithEmptyAbstract = {
        title: 'Test Paper',
        abstract: undefined,
      };

      const result = service.analyzeEprintRecord(recordWithEmptyAbstract);

      expect(result.isCurrentSchema).toBe(true);
      expect(result.compatibility.deprecatedFields).toHaveLength(0);
    });
  });

  describe('generateApiHints', () => {
    it('returns undefined for current schema', () => {
      const currentRecord = {
        title: 'Simple Title',
        abstract: [{ type: 'text', content: 'Rich text abstract' }],
      };

      const detection = service.analyzeEprintRecord(currentRecord);
      const hints = service.generateApiHints(detection);

      expect(hints).toBeUndefined();
    });

    it('generates hints for legacy schema', () => {
      const legacyRecord = {
        title: 'Simple Title',
        abstract: 'Plain text abstract',
      };

      const detection = service.analyzeEprintRecord(legacyRecord);
      const hints = service.generateApiHints(detection);

      expect(hints).toBeDefined();
      expect(hints?.schemaVersion).toBe('0.0.0');
      expect(hints?.deprecatedFields).toContain('abstract');
      expect(hints?.migrationAvailable).toBe(true);
      expect(hints?.migrationUrl).toContain('abstract-richtext');
    });
  });

  describe('needsMigration', () => {
    it('returns true for legacy format', () => {
      expect(service.needsMigration({ title: 'Test', abstract: 'string' })).toBe(true);
    });

    it('returns false for current format', () => {
      expect(
        service.needsMigration({
          title: 'Test',
          abstract: [{ type: 'text', content: 'array' }],
        })
      ).toBe(false);
    });

    it('returns false for empty abstract', () => {
      expect(service.needsMigration({ title: 'Test', abstract: undefined })).toBe(false);
    });
  });

  describe('currentVersion', () => {
    it('exposes current schema version', () => {
      expect(service.currentVersion).toEqual(CURRENT_EPRINT_SCHEMA_VERSION);
    });

    it('formats current version correctly', () => {
      expect(service.getCurrentVersionString()).toBe(
        formatSchemaVersion(CURRENT_EPRINT_SCHEMA_VERSION)
      );
    });
  });
});

describe('Schema Version Utilities', () => {
  describe('formatSchemaVersion', () => {
    it('formats version correctly', () => {
      expect(formatSchemaVersion({ major: 1, minor: 0, patch: 0 })).toBe('1.0.0');
      expect(formatSchemaVersion({ major: 2, minor: 5, patch: 13 })).toBe('2.5.13');
    });
  });

  describe('parseSchemaVersion', () => {
    it('parses valid version strings', () => {
      expect(parseSchemaVersion('1.0.0')).toEqual({ major: 1, minor: 0, patch: 0 });
      expect(parseSchemaVersion('2.5.13')).toEqual({ major: 2, minor: 5, patch: 13 });
    });

    it('parses large version numbers', () => {
      expect(parseSchemaVersion('100.200.300')).toEqual({ major: 100, minor: 200, patch: 300 });
    });

    it('parses version with zeros', () => {
      expect(parseSchemaVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
      expect(parseSchemaVersion('0.1.0')).toEqual({ major: 0, minor: 1, patch: 0 });
    });

    it('returns null for invalid strings', () => {
      expect(parseSchemaVersion('')).toBeNull();
      expect(parseSchemaVersion('1.0')).toBeNull();
      expect(parseSchemaVersion('1.0.0.0')).toBeNull();
      expect(parseSchemaVersion('v1.0.0')).toBeNull();
      expect(parseSchemaVersion('1.a.0')).toBeNull();
    });

    it('returns null for negative numbers', () => {
      expect(parseSchemaVersion('-1.0.0')).toBeNull();
      expect(parseSchemaVersion('1.-1.0')).toBeNull();
      expect(parseSchemaVersion('1.0.-1')).toBeNull();
    });

    it('returns null for whitespace', () => {
      expect(parseSchemaVersion(' 1.0.0')).toBeNull();
      expect(parseSchemaVersion('1.0.0 ')).toBeNull();
      expect(parseSchemaVersion('1. 0.0')).toBeNull();
    });
  });

  describe('compareSchemaVersions', () => {
    it('compares major versions', () => {
      const v1 = { major: 1, minor: 0, patch: 0 };
      const v2 = { major: 2, minor: 0, patch: 0 };

      expect(compareSchemaVersions(v1, v2)).toBeLessThan(0);
      expect(compareSchemaVersions(v2, v1)).toBeGreaterThan(0);
    });

    it('compares minor versions', () => {
      const v1 = { major: 1, minor: 1, patch: 0 };
      const v2 = { major: 1, minor: 2, patch: 0 };

      expect(compareSchemaVersions(v1, v2)).toBeLessThan(0);
      expect(compareSchemaVersions(v2, v1)).toBeGreaterThan(0);
    });

    it('compares patch versions', () => {
      const v1 = { major: 1, minor: 0, patch: 1 };
      const v2 = { major: 1, minor: 0, patch: 2 };

      expect(compareSchemaVersions(v1, v2)).toBeLessThan(0);
      expect(compareSchemaVersions(v2, v1)).toBeGreaterThan(0);
    });

    it('returns zero for equal versions', () => {
      const v1 = { major: 1, minor: 2, patch: 3 };
      const v2 = { major: 1, minor: 2, patch: 3 };

      expect(compareSchemaVersions(v1, v2)).toBe(0);
    });
  });
});
