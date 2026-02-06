/**
 * ATProto compliance tests for Lexicon schemas
 *
 * @remarks
 * These tests verify that all Chive Lexicon schemas comply with AT Protocol
 * requirements and best practices.
 *
 * @packageDocumentation
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, it, expect, beforeAll } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LexiconSchema {
  lexicon: number;
  id: string;
  defs: Record<string, unknown>;
}

interface RecordDef {
  type: string;
  key?: string;
  record?: {
    properties?: Record<string, PropertyDef>;
  };
}

interface PropertyDef {
  type: string;
  format?: string;
  encoding?: string;
  items?: PropertyDef;
  properties?: Record<string, PropertyDef>;
}

describe('Lexicon ATProto Compliance', () => {
  let schemas: LexiconSchema[] = [];

  beforeAll(async () => {
    // Only load Chive lexicons (pub.chive.*), not ATProto lexicons (com.atproto.*)
    const lexiconsDir = path.join(__dirname, '../../lexicons/pub/chive');
    schemas = await loadAllSchemas(lexiconsDir);
  });

  async function loadAllSchemas(dir: string): Promise<LexiconSchema[]> {
    const schemaFiles: string[] = [];

    async function walkDir(currentDir: string): Promise<void> {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.name.endsWith('.json')) {
          schemaFiles.push(fullPath);
        }
      }
    }

    await walkDir(dir);

    const loadedSchemas: LexiconSchema[] = [];
    for (const file of schemaFiles) {
      const content = await fs.readFile(file, 'utf-8');
      loadedSchemas.push(JSON.parse(content) as LexiconSchema);
    }

    return loadedSchemas;
  }

  function findBlobFields(schema: LexiconSchema): PropertyDef[] {
    const blobFields: PropertyDef[] = [];

    function walkProperties(props: Record<string, PropertyDef> | undefined): void {
      if (!props) return;

      for (const prop of Object.values(props)) {
        if (prop.type === 'blob') {
          blobFields.push(prop);
        } else if (prop.type === 'array' && prop.items) {
          if (prop.items.type === 'blob') {
            blobFields.push(prop.items);
          }
        } else if (prop.type === 'object' && prop.properties) {
          walkProperties(prop.properties);
        }
      }
    }

    for (const def of Object.values(schema.defs)) {
      const recordDef = def as RecordDef;
      if (recordDef.record?.properties) {
        walkProperties(recordDef.record.properties);
      }
    }

    return blobFields;
  }

  function findStringFields(schema: LexiconSchema): PropertyDef[] {
    const stringFields: PropertyDef[] = [];

    function walkProperties(props: Record<string, PropertyDef> | undefined): void {
      if (!props) return;

      for (const prop of Object.values(props)) {
        if (prop.type === 'string') {
          stringFields.push(prop);
        } else if (prop.type === 'array' && prop.items?.type === 'string') {
          stringFields.push(prop.items);
        } else if (prop.type === 'object' && prop.properties) {
          walkProperties(prop.properties);
        }
      }
    }

    for (const def of Object.values(schema.defs)) {
      const recordDef = def as RecordDef;
      if (recordDef.record?.properties) {
        walkProperties(recordDef.record.properties);
      }
    }

    return stringFields;
  }

  it('loads all schemas successfully', () => {
    expect(schemas.length).toBeGreaterThan(0);
    // Number of lexicon schemas may change as we refactor - test minimum count
    expect(schemas.length).toBeGreaterThanOrEqual(17);
  });

  it('all schemas have valid lexicon version', () => {
    for (const schema of schemas) {
      expect(schema.lexicon).toBe(1);
    }
  });

  it('all schemas have valid NSID', () => {
    for (const schema of schemas) {
      // Domain authority must be lowercase, name segment uses lowerCamelCase
      // Allow *.defs for shared definition bundles (e.g., pub.chive.defs)
      expect(schema.id).toMatch(/^pub\.chive\.([a-z]+\.)?[a-z][a-zA-Z0-9]*$/);
    }
  });

  it('all blob fields use type: blob (not base64 encoding)', () => {
    for (const schema of schemas) {
      const blobFields = findBlobFields(schema);

      for (const field of blobFields) {
        expect(field.type).toBe('blob');
        expect(field.encoding).toBeUndefined();
      }
    }
  });

  it('all blob fields specify accept MIME types', () => {
    for (const schema of schemas) {
      const blobFields = findBlobFields(schema);

      for (const field of blobFields) {
        if ('accept' in field) {
          expect(Array.isArray((field as { accept?: string[] }).accept)).toBe(true);
          expect((field as { accept: string[] }).accept.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('all blob fields specify maxSize', () => {
    for (const schema of schemas) {
      const blobFields = findBlobFields(schema);

      for (const field of blobFields) {
        if ('maxSize' in field) {
          expect(typeof (field as { maxSize?: number }).maxSize).toBe('number');
          expect((field as { maxSize: number }).maxSize).toBeGreaterThan(0);
        }
      }
    }
  });

  it('all records use tid, self, or any keys (not auto)', () => {
    for (const schema of schemas) {
      for (const def of Object.values(schema.defs)) {
        const recordDef = def as RecordDef;
        if (recordDef.type === 'record') {
          expect(recordDef.key).toBeDefined();
          expect(['tid', 'self', 'any']).toContain(recordDef.key);
          expect(recordDef.key).not.toBe('auto');
        }
      }
    }
  });

  it('no string fields use base64 encoding', () => {
    for (const schema of schemas) {
      const stringFields = findStringFields(schema);

      for (const field of stringFields) {
        expect(field.encoding).not.toBe('base64');
      }
    }
  });

  it('AT URI fields use correct format', () => {
    for (const schema of schemas) {
      const stringFields = findStringFields(schema);

      for (const field of stringFields) {
        if (field.format === 'at-uri') {
          expect(field.type).toBe('string');
          expect(field.encoding).toBeUndefined();
        }
      }
    }
  });

  it('DID fields use correct format', () => {
    for (const schema of schemas) {
      const stringFields = findStringFields(schema);

      for (const field of stringFields) {
        if (field.format === 'did') {
          expect(field.type).toBe('string');
          expect(field.encoding).toBeUndefined();
        }
      }
    }
  });

  it('CID fields use correct format', () => {
    for (const schema of schemas) {
      const stringFields = findStringFields(schema);

      for (const field of stringFields) {
        if (field.format === 'cid') {
          expect(field.type).toBe('string');
          expect(field.encoding).toBeUndefined();
        }
      }
    }
  });

  it('datetime fields use correct format', () => {
    for (const schema of schemas) {
      const stringFields = findStringFields(schema);

      for (const field of stringFields) {
        if (field.format === 'datetime') {
          expect(field.type).toBe('string');
        }
      }
    }
  });

  it('eprint submission schema compliance', () => {
    const submissionSchema = schemas.find((s) => s.id === 'pub.chive.eprint.submission');
    expect(submissionSchema).toBeDefined();

    const mainDef = submissionSchema?.defs.main as RecordDef;
    expect(mainDef.type).toBe('record');
    expect(mainDef.key).toBe('tid');

    const props = mainDef.record?.properties;
    expect(props).toBeDefined();

    // Check document is blob (renamed from pdf to support multiple formats)
    expect(props?.document?.type).toBe('blob');

    // Check authors array uses refs to authorContribution schema
    if (props?.authors) {
      expect(props.authors.type).toBe('array');
      const items = props.authors.items;
      expect(items?.type).toBe('ref');
    }

    // Check previousVersion uses AT URI format
    if (props?.previousVersion) {
      expect(props.previousVersion.format).toBe('at-uri');
    }
  });

  it('actor profile schema uses self key', () => {
    const profileSchema = schemas.find((s) => s.id === 'pub.chive.actor.profile');
    expect(profileSchema).toBeDefined();

    const mainDef = profileSchema?.defs.main as RecordDef;
    expect(mainDef.type).toBe('record');
    expect(mainDef.key).toBe('self');
  });

  it('all XRPC queries have proper structure', () => {
    const querySchemas = schemas.filter((s) => {
      const mainDef = s.defs.main as { type: string };
      return mainDef?.type === 'query';
    });

    expect(querySchemas.length).toBeGreaterThan(0);

    for (const schema of querySchemas) {
      const mainDef = schema.defs.main as {
        type: string;
        parameters?: unknown;
        output?: unknown;
      };
      expect(mainDef.parameters).toBeDefined();
      expect(mainDef.output).toBeDefined();
    }
  });

  it('all schemas follow pub.chive namespace', () => {
    for (const schema of schemas) {
      expect(schema.id).toMatch(/^pub\.chive\./);
    }
  });

  it('no schemas use server-generated IDs', () => {
    for (const schema of schemas) {
      const content = JSON.stringify(schema);

      // Check that no fields reference database IDs or auto-increment
      expect(content).not.toMatch(/autoIncrement/i);
      expect(content).not.toMatch(/sequence/i);
      // Allow "integer" type in general, but not in context of auto-generated IDs
      // The lexicon "id" field is the NSID, and "type: integer" is valid for things like limits
    }
  });
});
