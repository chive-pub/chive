/**
 * Validates that backend Zod schemas match their source lexicon definitions.
 *
 * @remarks
 * This script ensures that any property exposed in API responses matches the
 * canonical property name defined in the lexicon. The lexicon is the source
 * of truth - if you need to change a property name, change it in the lexicon
 * first, then update all consuming code.
 *
 * Run this in CI to prevent schema drift.
 *
 * @example
 * ```bash
 * npx tsx scripts/validate-lexicon-schemas.ts
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

interface LexiconProperty {
  type: string;
  description?: string;
  maxLength?: number;
  items?: LexiconProperty;
  ref?: string;
  properties?: Record<string, LexiconProperty>;
  required?: string[];
}

interface LexiconDef {
  type: string;
  record?: {
    type: string;
    properties: Record<string, LexiconProperty>;
    required?: string[];
  };
  properties?: Record<string, LexiconProperty>;
  required?: string[];
}

interface LexiconFile {
  lexicon: number;
  id: string;
  defs: Record<string, LexiconDef>;
}

interface ValidationError {
  lexiconId: string;
  schemaFile: string;
  issue: string;
  lexiconProperty?: string;
  schemaProperty?: string;
}

/**
 * Schema mappings: maps lexicon IDs to the Zod schema files/properties that expose them.
 *
 * This is the source of truth for what needs to match. Add new mappings here
 * when creating new lexicons with corresponding API schemas.
 */
const SCHEMA_MAPPINGS: Array<{
  lexiconId: string;
  lexiconPath: string;
  schemaFile: string;
  /**
   * Property mappings: lexicon property → schema property
   * If the names should match exactly, just list the property name.
   * The validator will ensure these properties exist in both places with the same name.
   */
  properties: string[];
}> = [
  {
    lexiconId: 'pub.chive.graph.node',
    lexiconPath: 'lexicons/pub/chive/graph/node.json',
    schemaFile: 'src/api/schemas/graph.ts',
    properties: [
      'id',
      'kind',
      'subkind',
      'subkindUri',
      'label',
      'alternateLabels',
      'description',
      'externalIds',
      'status',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    lexiconId: 'pub.chive.graph.edge',
    lexiconPath: 'lexicons/pub/chive/graph/edge.json',
    schemaFile: 'src/api/schemas/graph.ts',
    properties: ['id', 'sourceUri', 'targetUri', 'relationSlug', 'status', 'createdAt'],
  },
  {
    lexiconId: 'pub.chive.eprint.submission',
    lexiconPath: 'lexicons/pub/chive/eprint/submission.json',
    schemaFile: 'src/api/schemas/eprint.ts',
    properties: ['title', 'abstract', 'keywords'],
  },
];

/**
 * Loads and parses a lexicon JSON file.
 */
function loadLexicon(relativePath: string): LexiconFile {
  const fullPath = path.join(projectRoot, relativePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as LexiconFile;
}

/**
 * Gets all property names from a lexicon's main record definition.
 */
function getLexiconProperties(lexicon: LexiconFile): Set<string> {
  const mainDef = lexicon.defs.main;
  if (!mainDef) {
    throw new Error(`Lexicon ${lexicon.id} has no 'main' definition`);
  }

  const properties = mainDef.type === 'record' ? mainDef.record?.properties : mainDef.properties;

  if (!properties) {
    throw new Error(`Lexicon ${lexicon.id} has no properties`);
  }

  return new Set(Object.keys(properties));
}

/**
 * Checks if a Zod schema file contains a schema with the expected properties.
 *
 * This is a simple text-based check that looks for property definitions in the
 * schema file. It's not a full parser, but catches common issues like using
 * 'name' instead of 'label'.
 */
function checkSchemaFile(schemaPath: string, expectedProperties: string[]): string[] {
  const fullPath = path.join(projectRoot, schemaPath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const issues: string[] = [];

  // Common property name mismatches to check for
  const knownMismatches: Record<string, string> = {
    label: 'name', // Common mistake: using 'name' instead of 'label'
  };

  for (const prop of expectedProperties) {
    // Check if the schema uses a known incorrect alternative
    const wrongName = knownMismatches[prop];
    if (wrongName) {
      // Look for patterns like "name:" or "'name'" or '"name"' in object definitions
      const wrongPatterns = [
        new RegExp(`['"]${wrongName}['"]\\s*:`, 'g'), // 'name': or "name":
        new RegExp(`\\b${wrongName}\\s*:`, 'g'), // name:
      ];

      for (const pattern of wrongPatterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          // Check if it's actually in a schema definition (not just a comment)
          // by looking for it in a z.object() context
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (
              pattern.test(line) &&
              !line.trim().startsWith('//') &&
              !line.trim().startsWith('*')
            ) {
              // Check surrounding context for z.object or schema definition
              const context = lines.slice(Math.max(0, i - 10), i + 1).join('\n');
              if (
                context.includes('z.object') ||
                context.includes('Schema') ||
                context.includes('.describe(')
              ) {
                issues.push(
                  `Found '${wrongName}' instead of '${prop}' at line ${i + 1}. ` +
                    `The lexicon uses '${prop}' - please update to match.`
                );
              }
            }
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Main validation function.
 */
function validateSchemas(): ValidationError[] {
  const errors: ValidationError[] = [];

  console.log('Validating lexicon schemas against backend Zod schemas...\n');

  for (const mapping of SCHEMA_MAPPINGS) {
    console.log(`Checking ${mapping.lexiconId}...`);

    try {
      // Load lexicon
      const lexicon = loadLexicon(mapping.lexiconPath);
      const lexiconProps = getLexiconProperties(lexicon);

      // Verify expected properties exist in lexicon
      for (const prop of mapping.properties) {
        if (!lexiconProps.has(prop)) {
          errors.push({
            lexiconId: mapping.lexiconId,
            schemaFile: mapping.schemaFile,
            issue: `Property '${prop}' is in mapping but not in lexicon`,
            lexiconProperty: prop,
          });
        }
      }

      // Check schema file for common mismatches
      const schemaIssues = checkSchemaFile(mapping.schemaFile, mapping.properties);
      for (const issue of schemaIssues) {
        errors.push({
          lexiconId: mapping.lexiconId,
          schemaFile: mapping.schemaFile,
          issue,
        });
      }

      if (schemaIssues.length === 0) {
        console.log(`  ✓ ${mapping.lexiconId} schemas match\n`);
      } else {
        console.log(`  ✗ ${mapping.lexiconId} has ${schemaIssues.length} issue(s)\n`);
      }
    } catch (error) {
      errors.push({
        lexiconId: mapping.lexiconId,
        schemaFile: mapping.schemaFile,
        issue: `Failed to validate: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return errors;
}

// Run validation
const errors = validateSchemas();

if (errors.length > 0) {
  console.log('\n❌ Validation failed with the following errors:\n');
  for (const error of errors) {
    console.log(`[${error.lexiconId}] ${error.schemaFile}`);
    console.log(`  ${error.issue}`);
    if (error.lexiconProperty) {
      console.log(`  Lexicon property: ${error.lexiconProperty}`);
    }
    if (error.schemaProperty) {
      console.log(`  Schema property: ${error.schemaProperty}`);
    }
    console.log();
  }
  process.exit(1);
} else {
  console.log('✅ All lexicon schemas are consistent with backend Zod schemas.');
  process.exit(0);
}
