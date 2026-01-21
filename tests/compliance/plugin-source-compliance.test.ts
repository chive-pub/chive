/**
 * Plugin source identifier compliance tests.
 *
 * @remarks
 * Validates that all plugin source identifiers conform to the
 * importSourceSchema format requirements:
 * - Lowercase alphanumeric only (a-z, 0-9)
 * - 2-50 characters
 *
 * This test prevents the bug where plugin source values don't match
 * the API schema validation, causing 400 errors at runtime.
 *
 * @packageDocumentation
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { describe, it, expect } from 'vitest';

/**
 * Validates import source identifiers match the lexicon requirements.
 *
 * @remarks
 * Source identifiers must be:
 * - Lowercase alphanumeric only (a-z, 0-9)
 * - 2-50 characters
 *
 * This replaces the deleted Zod schema with a simple regex validation.
 */
const importSourceSchema = {
  safeParse: (value: string): { success: boolean; error?: { issues: { message: string }[] } } => {
    if (typeof value !== 'string') {
      return { success: false, error: { issues: [{ message: 'Expected string' }] } };
    }
    if (value.length < 2) {
      return {
        success: false,
        error: { issues: [{ message: 'Source must be at least 2 characters' }] },
      };
    }
    if (value.length > 50) {
      return {
        success: false,
        error: { issues: [{ message: 'Source must be at most 50 characters' }] },
      };
    }
    if (!/^[a-z0-9]+$/.test(value)) {
      return {
        success: false,
        error: { issues: [{ message: 'Source must be lowercase alphanumeric only' }] },
      };
    }
    return { success: true };
  },
};

/**
 * Extract source values from plugin TypeScript files.
 *
 * @remarks
 * Parses plugin files to find source identifier declarations.
 * Looks for patterns like:
 * - `readonly source = 'value'`
 * - `source: 'value'`
 */
function extractSourcesFromPlugins(): Map<string, string[]> {
  const pluginDir = join(__dirname, '../../src/plugins/builtin');
  const sources = new Map<string, string[]>();

  const files = readdirSync(pluginDir).filter((f) => f.endsWith('.ts'));

  for (const file of files) {
    const content = readFileSync(join(pluginDir, file), 'utf-8');

    // Match patterns like: source: 'value' or readonly source = 'value'
    const sourceMatches = content.matchAll(
      /(?:readonly\s+)?source\s*[:=]\s*['"]([a-zA-Z0-9_-]+)['"]/g
    );

    const fileSources: string[] = [];
    for (const match of sourceMatches) {
      const source = match[1];
      if (source && !fileSources.includes(source)) {
        fileSources.push(source);
      }
    }

    if (fileSources.length > 0) {
      sources.set(file, fileSources);
    }
  }

  return sources;
}

describe('Plugin Source Identifier Compliance', () => {
  const pluginSources = extractSourcesFromPlugins();

  it('finds source identifiers in plugin files', () => {
    // Sanity check: we should find sources
    expect(pluginSources.size).toBeGreaterThan(0);
  });

  describe('all plugin sources conform to importSourceSchema', () => {
    for (const [file, sources] of pluginSources) {
      for (const source of sources) {
        it(`${file}: "${source}" is a valid source identifier`, () => {
          const result = importSourceSchema.safeParse(source);

          if (!result.success) {
            // Provide helpful error message
            const errors = result
              .error!.issues.map((i: { message: string }) => i.message)
              .join(', ');
            throw new Error(
              `Plugin "${file}" uses source "${source}" which fails schema validation: ${errors}\n` +
                `Source identifiers must be lowercase alphanumeric (a-z, 0-9), 2-50 characters.`
            );
          }

          expect(result.success).toBe(true);
        });
      }
    }
  });

  describe('source identifier format requirements', () => {
    it('rejects uppercase characters', () => {
      expect(importSourceSchema.safeParse('ArXiv').success).toBe(false);
      expect(importSourceSchema.safeParse('ARXIV').success).toBe(false);
    });

    it('rejects hyphens', () => {
      expect(importSourceSchema.safeParse('semantic-scholar').success).toBe(false);
    });

    it('rejects underscores', () => {
      expect(importSourceSchema.safeParse('semantic_scholar').success).toBe(false);
    });

    it('rejects too short identifiers', () => {
      expect(importSourceSchema.safeParse('a').success).toBe(false);
    });

    it('accepts valid lowercase alphanumeric identifiers', () => {
      expect(importSourceSchema.safeParse('arxiv').success).toBe(true);
      expect(importSourceSchema.safeParse('semanticscholar').success).toBe(true);
      expect(importSourceSchema.safeParse('mybiorxiv2').success).toBe(true);
    });
  });
});
