/**
 * ATProto compliance tests for web frontend.
 *
 * Validates:
 * - Frontend fetches from Chive AppView API only (read-only)
 * - No direct writes to user PDSes
 * - PDS source information available for transparency
 * - BlobRefs used for document references (not blob data)
 */

import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const WEB_DIR = path.join(__dirname, '../../web');

/**
 * Directories excluded from compliance checks.
 *
 * @remarks
 * - node_modules, .next, dist, .storybook: Build/dependency directories
 * - tests: Test files and mocks are not production code
 * - lib/atproto: User-initiated PDS write utilities (users write to their own PDS,
 *   which is proper ATProto architecture; Chive AppView only reads from firehose)
 */
const EXCLUDED_DIRS = ['node_modules', '.next', 'dist', '.storybook', 'tests'];

/**
 * Paths excluded from PDS write pattern checks.
 *
 * @remarks
 * - lib/atproto: Contains legitimate user-initiated PDS write utilities.
 *   Users writing to their own PDS is proper ATProto architecture.
 *   The compliance rule is that Chive server never writes on users' behalf.
 * - lib/bluesky: Contains Share to Bluesky functionality where users post
 *   to their OWN Bluesky accounts using their authenticated session.
 * - lib/schemas: Contains TSDoc examples showing ATProto usage patterns.
 * - lib/hooks: Contains hooks for user-initiated PDS writes (activity logging,
 *   submission workflows). TSDoc examples show ATProto usage patterns.
 * - lib/auth: Contains E2E mock agent for testing (mock PDS operations).
 */
const PDS_WRITE_EXCLUDED_PATHS = [
  'lib/atproto',
  'lib/bluesky',
  'lib/schemas',
  'lib/hooks',
  'lib/auth',
  'components/governance', // User-initiated governance proposal writes to user's own PDS
];

function findTsFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry.name)) {
        findTsFiles(fullPath, files);
      }
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      if (!entry.name.includes('.test.') && !entry.name.includes('.stories.')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function readFileContent(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

describe('Frontend ATProto compliance', () => {
  describe('Read-only architecture', () => {
    it('does not contain PDS write operations', () => {
      const files = findTsFiles(WEB_DIR);
      const violations: string[] = [];

      const writePatterns = [
        /com\.atproto\.repo\.createRecord/,
        /com\.atproto\.repo\.putRecord/,
        /com\.atproto\.repo\.deleteRecord/,
        /com\.atproto\.repo\.applyWrites/,
        /com\.atproto\.sync\.updateRepo/,
        /\.POST\s*\(\s*['"`]\/xrpc\/com\.atproto/,
        /agent\.createRecord/,
        /agent\.deleteRecord/,
        /pds\.createRecord/,
      ];

      for (const file of files) {
        const relativePath = path.relative(WEB_DIR, file);

        // Skip files in excluded paths (user-initiated PDS writes, TSDoc examples)
        const isExcluded = PDS_WRITE_EXCLUDED_PATHS.some((excludedPath) =>
          relativePath.startsWith(excludedPath)
        );
        if (isExcluded) {
          continue;
        }

        const content = readFileContent(file);

        for (const pattern of writePatterns) {
          if (pattern.test(content)) {
            violations.push(`${relativePath}: Contains PDS write pattern: ${pattern.source}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('uses Chive AppView API endpoints, not direct PDS endpoints', () => {
      const hooksDir = path.join(WEB_DIR, 'lib/hooks');
      const files = findTsFiles(hooksDir);
      const violations: string[] = [];

      const directPdsPatterns = [
        /https?:\/\/[^/]*\.pds\./,
        /pds\.example\.com/,
        /bsky\.network\/xrpc/,
        /com\.atproto\.sync\./,
      ];

      for (const file of files) {
        const content = readFileContent(file);
        const relativePath = path.relative(WEB_DIR, file);

        for (const pattern of directPdsPatterns) {
          if (pattern.test(content)) {
            violations.push(`${relativePath}: Direct PDS access: ${pattern.source}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('API client compliance', () => {
    it('uses pub.chive.* XRPC endpoints for Chive data', () => {
      const schemaPath = path.join(WEB_DIR, 'lib/api/schema.d.ts');
      const content = readFileContent(schemaPath);

      expect(content).toContain('pub.chive.eprint');
      expect(content).toContain('pub.chive.graph');
      expect(content).toContain('pub.chive.metrics');
    });

    it('includes source PDS information in eprint types', () => {
      // Check generated schema (source of truth from OpenAPI spec)
      const generatedSchemaPath = path.join(WEB_DIR, 'lib/api/schema.generated.ts');
      const content = readFileContent(generatedSchemaPath);

      // ATProto compliance: eprints must include PDS source tracking
      expect(content).toContain('pdsEndpoint');
      expect(content).toContain('recordUrl');
      expect(content).toContain('stale');
    });

    it('uses BlobRef pattern for document references', () => {
      // Check domain types file for BlobRef interface
      const schemaPath = path.join(WEB_DIR, 'lib/api/schema.d.ts');
      const content = readFileContent(schemaPath);

      // ATProto compliance: BlobRef interface for file references
      expect(content).toContain('BlobRef');
      expect(content).toContain("$type: 'blob'");
      expect(content).toContain('ref: string');
      expect(content).toContain('mimeType: string');
      expect(content).toContain('size: number');
    });
  });

  describe('Data sovereignty transparency', () => {
    it('exposes PDS source in eprint API responses', () => {
      // Check generated schema for source field in eprint responses
      const generatedSchemaPath = path.join(WEB_DIR, 'lib/api/schema.generated.ts');
      const content = readFileContent(generatedSchemaPath);

      // ATProto compliance: API responses include source PDS information
      expect(content).toContain('pdsEndpoint');
      expect(content).toContain('PDS endpoint');
    });

    it('tracks staleness of indexed data', () => {
      // Check generated schema for staleness tracking fields
      const generatedSchemaPath = path.join(WEB_DIR, 'lib/api/schema.generated.ts');
      const content = readFileContent(generatedSchemaPath);

      // ATProto compliance: staleness tracking for data sovereignty
      expect(content).toContain('stale');
      expect(content).toContain('lastVerifiedAt');
    });
  });

  describe('Query configuration', () => {
    it('configures appropriate stale times', () => {
      const queryClientPath = path.join(WEB_DIR, 'lib/api/query-client.ts');
      const content = readFileContent(queryClientPath);

      expect(content).toContain('staleTime');
      expect(content).toMatch(/staleTime:\s*30\s*\*\s*1000/);
    });

    it('enables refetch on window focus', () => {
      const queryClientPath = path.join(WEB_DIR, 'lib/api/query-client.ts');
      const content = readFileContent(queryClientPath);

      expect(content).toContain('refetchOnWindowFocus: true');
    });
  });

  describe('Type safety', () => {
    it('does not use any type', () => {
      const files = findTsFiles(WEB_DIR);
      const violations: string[] = [];

      for (const file of files) {
        const content = readFileContent(file);
        const relativePath = path.relative(WEB_DIR, file);

        const anyPattern = /:\s*any\b|<any>|as any\b/g;
        const matches = content.match(anyPattern);

        if (matches) {
          violations.push(`${relativePath}: Uses 'any' type ${matches.length} time(s)`);
        }
      }

      expect(violations).toEqual([]);
    });

    it('uses TypeScript strict mode', () => {
      const tsconfigPath = path.join(WEB_DIR, 'tsconfig.json');
      const content = readFileContent(tsconfigPath);

      const tsconfig = JSON.parse(content) as { compilerOptions: { strict: boolean } };
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });
  });
});
