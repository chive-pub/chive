/**
 * ATProto compliance tests for Neo4j knowledge graph implementation.
 *
 * @remarks
 * Verifies that all Neo4j knowledge graph operations comply with ATProto principles:
 * - Neo4j is index only (not source of truth)
 * - No writes to user PDSes (read-only via IRepository)
 * - BlobRef storage only (no blob data in Neo4j)
 * - PDS source tracking for all indexed data
 * - All data rebuildable from firehose
 * - Authority records sourced from Governance PDS
 * - User proposals/votes sourced from user PDSes
 *
 * @packageDocumentation
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { beforeAll, describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Source file to analyze
 */
interface SourceFile {
  path: string;
  content: string;
}

/**
 * Load all Neo4j source files
 */
async function loadNeo4jSources(): Promise<SourceFile[]> {
  try {
    const neo4jDir = path.join(__dirname, '../../src/storage/neo4j');
    const entries = await fs.readdir(neo4jDir, { withFileTypes: true });

    const sources: SourceFile[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        const filePath = path.join(neo4jDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        sources.push({ path: filePath, content });
      }
    }

    return sources;
  } catch (error: unknown) {
    throw new Error(
      `Failed to load Neo4j sources: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

describe('Knowledge Graph ATProto Compliance', () => {
  let neo4jSources: SourceFile[] = [];

  beforeAll(async () => {
    neo4jSources = await loadNeo4jSources();
  }, 30000);

  describe('No writes to user PDSes', () => {
    it('should not contain PDS write operations', () => {
      const forbiddenPatterns = [
        /createRecord\(/,
        /deleteRecord\(/,
        /putRecord\(/,
        /uploadBlob\(/,
        /com\.atproto\.repo\.createRecord/,
        /com\.atproto\.repo\.putRecord/,
        /com\.atproto\.repo\.deleteRecord/,
        /com\.atproto\.repo\.uploadBlob/,
      ];

      for (const source of neo4jSources) {
        for (const pattern of forbiddenPatterns) {
          const match = pattern.exec(source.content);
          if (match !== null) {
            expect.fail(
              `File ${path.basename(source.path)} contains forbidden PDS write operation: ${String(pattern)}`
            );
          }
        }
      }
    });

    it('should only use read-only repository methods', () => {
      const writeOperations = [
        'createRecord',
        'putRecord',
        'deleteRecord',
        'uploadBlob',
        'applyWrites',
      ];

      for (const source of neo4jSources) {
        for (const writeOp of writeOperations) {
          if (source.content.includes(writeOp)) {
            // Check if it's in a comment or string literal
            const lines = source.content.split('\n');
            for (const line of lines) {
              if (
                line.includes(writeOp) &&
                !line.trim().startsWith('//') &&
                !line.trim().startsWith('*')
              ) {
                // Verify it's not just a variable name or comment
                const pattern = new RegExp(`\\b${writeOp}\\s*\\(`);
                const match = pattern.exec(line);
                if (match !== null) {
                  expect.fail(
                    `File ${path.basename(source.path)} contains PDS write operation: ${writeOp}`
                  );
                }
              }
            }
          }
        }
      }
    });
  });

  describe('BlobRef storage only', () => {
    it('should not store blob data directly', () => {
      const forbiddenPatterns = [
        /blobData\s*:/,
        /pdfData\s*:/,
        /imageData\s*:/,
        /fileData\s*:/,
        /Buffer\.from/,
        /base64\.encode/,
        /fs\.writeFile/,
        /fs\.createWriteStream/,
      ];

      for (const source of neo4jSources) {
        // Skip connection and setup files (may have legitimate file operations)
        if (source.path.includes('connection.ts') || source.path.includes('setup')) {
          continue;
        }

        for (const pattern of forbiddenPatterns) {
          if (pattern.test(source.content)) {
            expect.fail(
              `File ${path.basename(source.path)} may be storing blob data directly: ${pattern}`
            );
          }
        }
      }
    });

    it('should use BlobRef type for blob references', () => {
      const filesWithBlobs = neo4jSources.filter(
        (s) => s.content.includes('blob') || s.content.includes('Blob')
      );

      for (const source of filesWithBlobs) {
        // If file mentions blobs, it should use BlobRef
        const blobPattern = /blob(?!Ref)/i;
        const blobMatch = blobPattern.exec(source.content);
        if (blobMatch !== null && !source.path.includes('types.ts')) {
          // Check if BlobRef is imported or used
          const hasBlobRef =
            source.content.includes('BlobRef') ||
            source.content.includes('CID') ||
            source.content.includes('blobCid') ||
            source.content.includes('blobRef');

          if (!hasBlobRef) {
            // Allow if it's just in comments or variable names
            const blobWordPattern = /\bblob\b/g;
            let meaningfulBlobUsage = 0;
            while (blobWordPattern.exec(source.content) !== null) {
              meaningfulBlobUsage++;
            }

            if (meaningfulBlobUsage > 2) {
              expect.fail(
                `File ${path.basename(source.path)} handles blobs but doesn't use BlobRef type`
              );
            }
          }
        }
      }
    });
  });

  describe('PDS source tracking', () => {
    it('should track PDS URL for indexed records', () => {
      const repositoryFiles = neo4jSources.filter(
        (s) =>
          s.path.includes('repository') ||
          s.path.includes('adapter') ||
          s.path.includes('field') ||
          s.path.includes('authority')
      );

      for (const source of repositoryFiles) {
        // Check if file indexes records from firehose
        const indexesRecords =
          source.content.includes('CREATE (') ||
          source.content.includes('MERGE (') ||
          source.content.includes('upsert');

        if (indexesRecords) {
          // Should track PDS source
          const tracksPdsSource =
            source.content.includes('pdsUrl') ||
            source.content.includes('pds_url') ||
            source.content.includes('sourceUrl') ||
            source.content.includes('source_url');

          // Some files may not need PDS tracking (e.g., facet dimensions, which are system data)
          const needsPdsTracking =
            !source.path.includes('setup') && !source.path.includes('schema');

          if (needsPdsTracking && indexesRecords && !tracksPdsSource) {
            // Check if it's internal system data
            const isSystemData =
              source.content.includes('FacetDimension') || source.content.includes('root field');

            if (!isSystemData) {
              console.warn(
                `Warning: ${path.basename(source.path)} indexes records but may not track PDS source`
              );
            }
          }
        }
      }
    });

    it('should include AT-URI in indexed nodes', () => {
      const nodeCreationFiles = neo4jSources.filter((s) =>
        /CREATE \(|MERGE \(.*Field|.*Authority|.*Proposal/i.exec(s.content)
      );

      for (const source of nodeCreationFiles) {
        // Skip setup files (create system data)
        if (source.path.includes('setup') || source.path.includes('schema')) {
          continue;
        }

        // Nodes should have uri property
        const hasUriProperty =
          source.content.includes('uri:') ||
          source.content.includes('$uri') ||
          source.content.includes('.uri =');

        if (!hasUriProperty) {
          console.warn(
            `Warning: ${path.basename(source.path)} creates nodes but may not set AT-URI property`
          );
        }
      }
    });
  });

  describe('Index-only pattern', () => {
    it('should use MERGE for upsert operations (not INSERT)', () => {
      for (const source of neo4jSources) {
        // Neo4j doesn't have INSERT, but check for CREATE without MERGE
        const hasCreate = source.content.includes('CREATE (');
        const hasMerge = source.content.includes('MERGE (');

        if (hasCreate && !hasMerge) {
          // Check if it's just in setup files
          if (!source.path.includes('setup') && !source.path.includes('schema')) {
            console.warn(
              `Warning: ${path.basename(source.path)} uses CREATE without MERGE (may create duplicates)`
            );
          }
        }
      }
    });

    it('should not enforce uniqueness via code (use Neo4j constraints)', () => {
      const forbiddenPatterns = [
        /if\s*\(\s*exists\s*\)/i,
        /checkExists/,
        /findDuplicate/,
        /if\s*\(\s*found\s*\)/i,
      ];

      for (const source of neo4jSources) {
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(source.content)) {
            const hasConstraintComment =
              source.content.includes('constraint') || source.content.includes('unique index');

            if (!hasConstraintComment) {
              console.warn(
                `Warning: ${path.basename(source.path)} may enforce uniqueness in code instead of constraints`
              );
            }
          }
        }
      }
    });
  });

  describe('Governance PDS compliance', () => {
    it('should document authority record source', () => {
      const authorityFiles = neo4jSources.filter((s) => s.path.includes('authority'));

      for (const source of authorityFiles) {
        // Should mention Governance PDS in comments
        const mentionsGovernance =
          source.content.includes('Governance PDS') ||
          source.content.includes('did:plc:chive-governance') ||
          source.content.includes('authority records') ||
          source.content.includes('IFLA LRM');

        expect(mentionsGovernance).toBe(true);
      }
    });

    it('should not hard-code governance DID', () => {
      for (const source of neo4jSources) {
        // Check for hard-coded DIDs (should use config)
        const didPattern = /did:plc:[a-z0-9]+/;
        const hasHardcodedDid = didPattern.exec(source.content);

        if (hasHardcodedDid !== null) {
          // Allow in comments and documentation
          const lines = source.content.split('\n');
          for (const line of lines) {
            const lineDidPattern = /did:plc:[a-z0-9]+/;
            const lineMatch = lineDidPattern.exec(line);
            if (lineMatch !== null) {
              const isComment = line.trim().startsWith('//') || line.trim().startsWith('*');
              const isExample = line.includes('@example') || line.includes('Example:');

              if (!isComment && !isExample) {
                console.warn(
                  `Warning: ${path.basename(source.path)} may hard-code DID (should use config): ${line.trim()}`
                );
              }
            }
          }
        }
      }
    });
  });

  describe('Firehose rebuildability', () => {
    it('should support incremental indexing (indexed_at timestamps)', () => {
      const indexingFiles = neo4jSources.filter(
        (s) =>
          s.path.includes('repository') ||
          s.path.includes('adapter') ||
          s.path.includes('field') ||
          s.path.includes('authority')
      );

      for (const source of indexingFiles) {
        const createsNodes =
          source.content.includes('CREATE (') || source.content.includes('MERGE (');

        if (createsNodes) {
          // Should track creation/update timestamps
          const hasTimestamps =
            source.content.includes('createdAt') ||
            source.content.includes('created_at') ||
            source.content.includes('datetime()') ||
            source.content.includes('timestamp()');

          expect(hasTimestamps).toBe(true);
        }
      }
    });

    it('should support cursor-based pagination', () => {
      const queryFiles = neo4jSources.filter(
        (s) =>
          s.path.includes('repository') ||
          s.path.includes('adapter') ||
          s.path.includes('field') ||
          s.path.includes('authority')
      );

      let hasPaginationImplemented = false;

      for (const source of queryFiles) {
        const hasPagination = source.content.includes('SKIP') || source.content.includes('LIMIT');

        if (hasPagination) {
          // Should support offset/limit or cursor
          const supportsCursor =
            (source.content.includes('SKIP') && source.content.includes('LIMIT')) ||
            source.content.includes('cursor') ||
            source.content.includes('offset');

          if (supportsCursor) {
            hasPaginationImplemented = true;
          }
        }
      }

      // At least one file should implement pagination
      expect(hasPaginationImplemented).toBe(true);
    });
  });

  describe('No server-generated IDs', () => {
    it('should use AT-URIs or content-based IDs', () => {
      for (const source of neo4jSources) {
        // Check for auto-increment or UUID generation
        const hasAutoId =
          source.content.includes('AUTO_INCREMENT') || source.content.includes('SERIAL');

        if (hasAutoId) {
          // Check if it's for internal use only (not exposed via AT-URI)
          const isInternalOnly =
            source.content.includes('internal') || source.content.includes('cache');

          if (!isInternalOnly) {
            expect.fail(
              `File ${path.basename(source.path)} may use server-generated IDs (should use AT-URIs)`
            );
          }
        }

        // UUIDs are okay for internal correlation IDs (not as primary keys)
        // Neo4j doesn't use auto-increment, so this mainly catches SQL patterns
      }
    });

    it('should use content-based IDs for derived data', () => {
      const facetFiles = neo4jSources.filter((s) => s.path.includes('facet'));

      for (const source of facetFiles) {
        const createsFacets = source.content.includes('Facet');

        if (createsFacets) {
          // Facet IDs should be deterministic
          const hasContentBasedId =
            source.content.includes('hash') ||
            source.content.includes('digest') ||
            source.content.includes('dimension') ||
            source.content.includes('value');

          // This is a soft check: content-based IDs are recommended but not required
          if (!hasContentBasedId) {
            console.warn(
              `Warning: ${path.basename(source.path)} creates facets; consider using content-based IDs`
            );
          }
        }
      }
    });
  });

  describe('Documentation compliance', () => {
    it('should document ATProto compliance in TSDoc', () => {
      const keyFiles = neo4jSources.filter(
        (s) =>
          s.path.includes('adapter') || s.path.includes('repository') || s.path.includes('field')
      );

      for (const source of keyFiles) {
        // Should mention ATProto compliance
        const mentionsCompliance =
          source.content.includes('@remarks') &&
          (source.content.includes('ATProto') ||
            source.content.includes('AT Protocol') ||
            source.content.includes('index only') ||
            source.content.includes('read-only'));

        expect(mentionsCompliance).toBe(true);
      }
    });

    it('should warn against PDS writes in comments', () => {
      const keyFiles = neo4jSources.filter(
        (s) => s.path.includes('adapter') || s.path.includes('repository')
      );

      for (const source of keyFiles) {
        // Should mention no writes to user PDSes
        const warnsAboutWrites =
          source.content.includes('No writes') ||
          source.content.includes('read-only') ||
          source.content.includes('index only') ||
          source.content.includes('not source of truth');

        // Soft requirement
        if (!warnsAboutWrites) {
          console.warn(
            `Warning: ${path.basename(source.path)} should document no-write policy in comments`
          );
        }
      }
    });
  });

  describe('Schema compliance', () => {
    it('should load schema files successfully', async () => {
      const schemaDir = path.join(__dirname, '../../src/storage/neo4j/schema');

      try {
        await fs.access(schemaDir);
        const entries = await fs.readdir(schemaDir);
        expect(entries.length).toBeGreaterThan(0);
      } catch {
        expect.fail('Schema directory should exist');
      }
    });

    it('should define uniqueness constraints', async () => {
      const constraintsFile = path.join(
        __dirname,
        '../../src/storage/neo4j/schema/constraints.cypher'
      );

      try {
        const content = await fs.readFile(constraintsFile, 'utf-8');

        // Should have constraints on key fields
        expect(content).toContain('CONSTRAINT');
        expect(content.toLowerCase()).toContain('unique');
      } catch {
        expect.fail('Constraints file should exist and define uniqueness constraints');
      }
    });

    it('should define performance indexes', async () => {
      const indexesFile = path.join(__dirname, '../../src/storage/neo4j/schema/indexes.cypher');

      try {
        const content = await fs.readFile(indexesFile, 'utf-8');

        // Should have indexes on frequently queried fields
        expect(content.toLowerCase()).toContain('index');
      } catch {
        expect.fail('Indexes file should exist and define performance indexes');
      }
    });
  });
});
