/**
 * Integration tests for Lexicon code generation pipeline
 *
 * @packageDocumentation
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { describe, it, expect } from 'vitest';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Lexicon Code Generation Pipeline', () => {
  it('generates validators successfully', async () => {
    const { stderr } = await execAsync('node scripts/generate-zod-validators.js', {
      cwd: path.join(__dirname, '../../..'),
    });

    // Local refs should now be supported, so no warnings expected
    const stderrLines = stderr
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    // No warnings should be emitted for local refs
    expect(stderrLines.length).toBe(0);
  }, 30000);

  it('generates all expected validator files', async () => {
    const validatorsDir = path.join(__dirname, '../../../src/lexicons/validators');

    const expectedFiles = [
      'pub/chive/actor/profile.ts',
      'pub/chive/graph/facet.ts',
      'pub/chive/graph/fieldProposal.ts',
      'pub/chive/graph/vote.ts',
      'pub/chive/preprint/getSubmission.ts',
      'pub/chive/preprint/searchSubmissions.ts',
      'pub/chive/preprint/submission.ts',
      'pub/chive/preprint/userTag.ts',
      'pub/chive/preprint/version.ts',
      'pub/chive/review/comment.ts',
      'pub/chive/review/endorsement.ts',
      'pub/chive/review/entityLink.ts',
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(validatorsDir, file);
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);
    }
  });

  it('generated TypeScript compiles without errors', async () => {
    const { stderr } = await execAsync('pnpm typecheck', {
      cwd: path.join(__dirname, '../../..'),
    });

    expect(stderr).not.toContain('error');
  }, 30000);

  it('generated validators export schemas', async () => {
    const { preprintSubmissionSchema } =
      await import('../../../src/lexicons/validators/pub/chive/preprint/submission.js');
    const { reviewCommentSchema } =
      await import('../../../src/lexicons/validators/pub/chive/review/comment.js');
    const { actorProfileSchema } =
      await import('../../../src/lexicons/validators/pub/chive/actor/profile.js');

    expect(preprintSubmissionSchema).toBeDefined();
    expect(reviewCommentSchema).toBeDefined();
    expect(actorProfileSchema).toBeDefined();
  });

  it('generated validators work correctly', async () => {
    const { preprintSubmissionSchema } =
      await import('../../../src/lexicons/validators/pub/chive/preprint/submission.js');

    const validData = {
      title: 'Test Preprint',
      abstract: 'Abstract',
      pdf: {
        $type: 'blob',
        ref: {
          $link: 'bafyreibwkjvc2wlkqn3v6jxlp2w3z4',
        },
        mimeType: 'application/pdf',
        size: 1000,
      },
      license: 'CC-BY-4.0',
      createdAt: new Date().toISOString(),
    };

    expect(() => preprintSubmissionSchema.parse(validData)).not.toThrow();

    const invalidData = {
      title: 'Test',
      // Missing required fields
    };

    expect(() => preprintSubmissionSchema.parse(invalidData)).toThrow();
  });

  it('generated files include proper TSDoc comments', async () => {
    const submissionFile = path.join(
      __dirname,
      '../../../src/lexicons/validators/pub/chive/preprint/submission.ts'
    );
    const content = await fs.readFile(submissionFile, 'utf-8');

    expect(content).toContain('/**');
    expect(content).toContain('* @');
    expect(content).toContain('pub.chive.preprint.submission');
  });

  it('generated files do not contain AI slop', async () => {
    const validatorsDir = path.join(__dirname, '../../../src/lexicons/validators');

    async function checkFile(filePath: string): Promise<void> {
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for dashes outside of @param documentation
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && line.includes('//') && !line.includes('@param') && line.includes(' - ')) {
          throw new Error(`Found dash in comment at ${filePath}:${i + 1}: ${line}`);
        }
      }
    }

    async function walkDir(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.name.endsWith('.ts')) {
          await checkFile(fullPath);
        }
      }
    }

    await walkDir(validatorsDir);
  });

  it('generated validators include proper exports', async () => {
    const submissionFile = path.join(
      __dirname,
      '../../../src/lexicons/validators/pub/chive/preprint/submission.ts'
    );
    const content = await fs.readFile(submissionFile, 'utf-8');

    expect(content).toContain('export const preprintSubmissionSchema');
    expect(content).toContain('export type PreprintSubmission');
  });

  it('facet.ts correctly handles non-record schema', async () => {
    const facetFile = path.join(
      __dirname,
      '../../../src/lexicons/validators/pub/chive/graph/facet.ts'
    );
    const content = await fs.readFile(facetFile, 'utf-8');

    // Facet is an object type, not a record, so it should have minimal content
    // The generator currently outputs an empty file with just headers
    expect(content).toContain('pub.chive.graph.facet');
  });
});
