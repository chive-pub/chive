/**
 * Lexicon validator wrapper for AT Protocol schema validation.
 *
 * @remarks
 * This module provides a wrapper around the `@atproto/lexicon` validator
 * for validating Chive records and XRPC parameters against Lexicon schemas.
 *
 * @packageDocumentation
 * @public
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { Lexicons, type LexiconDoc } from '@atproto/lexicon';

import { ValidationError } from '../types/errors.js';
import type { ValidationResult } from '../types/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Lexicon validator for Chive schemas.
 *
 * @remarks
 * Wraps `@atproto/lexicon` validator to provide type-safe validation
 * of records and XRPC parameters against Chive Lexicon schemas.
 *
 * @example
 * ```typescript
 * const validator = new LexiconValidator();
 * await validator.loadSchemas();
 *
 * const result = validator.validateRecord(
 *   'pub.chive.eprint.submission',
 *   eprintData
 * );
 *
 * if (result.valid) {
 *   console.log('Valid eprint!');
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 *
 * @public
 */
export class LexiconValidator {
  private readonly lexicons: Lexicons;
  private loaded = false;

  constructor() {
    this.lexicons = new Lexicons();
  }

  /**
   * Loads Lexicon schemas from the lexicons directory.
   *
   * @remarks
   * Recursively loads all .json files from the lexicons directory
   * and registers them with the validator.
   *
   * @param schemasDir - Directory containing lexicon schemas (default: lexicons/)
   * @returns Promise that resolves when schemas are loaded
   * @throws {Error} If schema file cannot be read or parsed
   *
   * @public
   */
  async loadSchemas(schemasDir?: string): Promise<void> {
    const dir = schemasDir ?? path.join(__dirname, '../../lexicons');
    const files = await this.findSchemaFiles(dir);

    for (const file of files) {
      try {
        const schema = JSON.parse(await fs.readFile(file, 'utf-8')) as LexiconDoc;
        this.lexicons.add(schema);
      } catch (error) {
        throw new ValidationError(
          `Failed to load schema ${file}: ${error instanceof Error ? error.message : String(error)}`,
          'schema',
          'invalid',
          error instanceof Error ? error : undefined
        );
      }
    }

    this.loaded = true;
  }

  /**
   * Validates a record against its Lexicon schema.
   *
   * @param nsid - Schema NSID (e.g., "pub.chive.eprint.submission")
   * @param value - Record value to validate
   * @returns Validation result with errors if invalid
   *
   * @remarks
   * Uses `@atproto/lexicon` to validate the record structure,
   * types, and constraints defined in the schema.
   *
   * @example
   * ```typescript
   * const result = validator.validateRecord(
   *   'pub.chive.eprint.submission',
   *   {
   *     title: 'My Paper',
   *     abstract: 'Abstract text',
   *     pdf: { $type: 'blob', ref: 'bafyrei...', mimeType: 'application/pdf', size: 1000 },
   *     license: 'CC-BY-4.0',
   *     createdAt: new Date().toISOString()
   *   }
   * );
   * ```
   *
   * @public
   */
  validateRecord(nsid: string, value: unknown): ValidationResult {
    this.ensureLoaded();

    try {
      this.lexicons.assertValidRecord(nsid, value);
      return { valid: true, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        errors: [
          {
            field: 'record',
            valid: false,
            errors: [errorMessage],
          },
        ],
      };
    }
  }

  /**
   * Validates XRPC query or procedure parameters.
   *
   * @param nsid - Procedure/query NSID
   * @param params - Parameters object
   * @returns Validation result with errors if invalid
   *
   * @remarks
   * Validates parameters for XRPC queries and procedures against
   * the schema's parameter definitions.
   *
   * @example
   * ```typescript
   * const result = validator.validateParams(
   *   'pub.chive.eprint.searchSubmissions',
   *   {
   *     q: 'neural networks',
   *     limit: 25
   *   }
   * );
   * ```
   *
   * @public
   */
  validateParams(nsid: string, params: unknown): ValidationResult {
    this.ensureLoaded();

    try {
      this.lexicons.assertValidXrpcParams(nsid, params);
      return { valid: true, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        errors: [
          {
            field: 'params',
            valid: false,
            errors: [errorMessage],
          },
        ],
      };
    }
  }

  /**
   * Finds all JSON schema files recursively.
   *
   * @param dir - Directory to search
   * @returns Array of file paths
   *
   * @internal
   */
  private async findSchemaFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.findSchemaFiles(fullPath)));
      } else if (entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Ensures schemas are loaded before validation.
   *
   * @throws Error if schemas not loaded
   *
   * @internal
   */
  private ensureLoaded(): void {
    if (!this.loaded) {
      throw new ValidationError(
        'Schemas not loaded. Call loadSchemas() first.',
        'schemas',
        'not_loaded'
      );
    }
  }
}
