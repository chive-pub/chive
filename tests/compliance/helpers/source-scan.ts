/**
 * Source-level assertions for the ATProto compliance suite.
 *
 * @remarks
 * Several compliance rules are claims about what code does *not* do — a
 * service must never write to a user's PDS, a cache must never hold a value
 * without an expiry. Those are awkward to demonstrate by executing the code,
 * because the passing case is the absence of a call. Reading the source and
 * asserting the call is not there tests exactly the claim, and fails the day
 * somebody adds one.
 *
 * The scan strips comments and string literals first. Without that, a comment
 * reading "never calls createRecord" would register as a `createRecord` call
 * and the check would report a violation that does not exist — and, worse, a
 * check written to require a call would pass on the strength of a comment.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root, resolved from this file's location. */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Method names that write to a repository through the ATProto XRPC surface.
 *
 * @remarks
 * Chive is an AppView: it indexes what PDSes publish and owns none of it.
 * Any of these appearing in AppView code means the service is attempting to
 * mutate a repository it does not own.
 *
 * @public
 */
export const PDS_WRITE_CALLS = [
  'createRecord',
  'putRecord',
  'deleteRecord',
  'applyWrites',
  'uploadBlob',
  'importRepo',
] as const;

/**
 * Read a repository file with comments and string literals removed.
 *
 * @param relativePath - Path relative to the repository root
 * @returns Executable source text, with comments and literals blanked out
 *
 * @throws If the file does not exist. A compliance test naming a file that has
 * been moved should fail loudly rather than vacuously pass on empty input.
 *
 * @public
 */
export function readExecutableSource(relativePath: string): string {
  const source = readFileSync(join(REPO_ROOT, relativePath), 'utf8');
  return stripCommentsAndStrings(source);
}

/**
 * Remove comments and string literals from TypeScript source.
 *
 * @param source - Raw source text
 * @returns The same text with comments and literal contents replaced by spaces
 *
 * @remarks
 * Length is preserved so reported offsets still line up with the original.
 * This is a lexical pass, not a parse: it tracks which of the five contexts
 * (code, line comment, block comment, quoted string, template literal) each
 * character sits in, which is all the call-site checks need.
 */
export function stripCommentsAndStrings(source: string): string {
  const out: string[] = [];
  let i = 0;
  type Mode = 'code' | 'line' | 'block' | 'single' | 'double' | 'template';
  let mode: Mode = 'code';

  while (i < source.length) {
    const ch = source[i] ?? '';
    const next = source[i + 1] ?? '';

    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        mode = 'line';
        out.push('  ');
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        mode = 'block';
        out.push('  ');
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        mode = ch === "'" ? 'single' : ch === '"' ? 'double' : 'template';
        out.push(' ');
        i += 1;
        continue;
      }
      out.push(ch);
      i += 1;
      continue;
    }

    if (mode === 'line') {
      if (ch === '\n') {
        mode = 'code';
        out.push('\n');
      } else {
        out.push(' ');
      }
      i += 1;
      continue;
    }

    if (mode === 'block') {
      if (ch === '*' && next === '/') {
        mode = 'code';
        out.push('  ');
        i += 2;
        continue;
      }
      out.push(ch === '\n' ? '\n' : ' ');
      i += 1;
      continue;
    }

    // Inside a string or template literal.
    if (ch === '\\') {
      out.push('  ');
      i += 2;
      continue;
    }
    const closer = mode === 'single' ? "'" : mode === 'double' ? '"' : '`';
    if (ch === closer) {
      mode = 'code';
      out.push(' ');
      i += 1;
      continue;
    }
    out.push(ch === '\n' ? '\n' : ' ');
    i += 1;
  }

  return out.join('');
}

/**
 * Find calls to any of the given method names in executable source.
 *
 * @param source - Source text, already passed through {@link readExecutableSource}
 * @param methods - Method names to look for
 * @returns The names found, deduplicated
 *
 * @remarks
 * Matches `.name(` and bare `name(`, so both `agent.createRecord(...)` and a
 * destructured `createRecord(...)` are caught. An explicit type argument list
 * is allowed between the two — `getRecord<RawFacetRecord>(uri)` is the same
 * call as `getRecord(uri)` and must not slip past the check.
 *
 * @public
 */
export function findCalls(source: string, methods: readonly string[]): string[] {
  const found = new Set<string>();
  for (const method of methods) {
    const pattern = new RegExp(
      `(?:^|[^A-Za-z0-9_$])${method}\\s*(?:<[^()<>]*(?:<[^()<>]*>[^()<>]*)*>)?\\s*\\(`,
      'm'
    );
    if (pattern.test(source)) found.add(method);
  }
  return [...found];
}

/**
 * Read a configuration file as text.
 *
 * @param relativePath - Path relative to the repository root
 * @returns The file's contents
 *
 * @throws If the file does not exist, so a test cannot pass by asserting
 * against a config that was deleted or renamed.
 *
 * @public
 */
export function readConfig(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf8');
}
