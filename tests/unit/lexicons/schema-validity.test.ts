import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LEXICON_DIR = join(REPO_ROOT, 'lexicons');

interface LexiconNode {
  type?: string;
  properties?: Record<string, LexiconNode>;
  required?: string[];
  [key: string]: unknown;
}

function lexiconFiles(dir: string): string[] {
  const out: string[] = [];
  // `withFileTypes` answers from the directory entry itself. Reading the name
  // and stat-ing it separately is a check-then-use on the filesystem.
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...lexiconFiles(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

const documents = lexiconFiles(LEXICON_DIR).map((path) => ({
  path: path.slice(REPO_ROOT.length + 1),
  doc: JSON.parse(readFileSync(path, 'utf8')) as { defs: Record<string, LexiconNode> },
}));

/** Walk every node in a lexicon, yielding a readable path for failure messages. */
function walk(node: unknown, path: string, visit: (node: LexiconNode, path: string) => void): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => walk(child, `${path}[${i}]`, visit));
    return;
  }
  if (node === null || typeof node !== 'object') return;

  visit(node as LexiconNode, path);
  for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
    walk(child, `${path}/${key}`, visit);
  }
}

/**
 * Constraints the Lexicon specification does not define are silently ignored by
 * every validator, so a schema carrying one promises something it never
 * enforces. Three were doing exactly that, and all three were invisible because
 * the code generator prepended `// @ts-nocheck` to the entire generated tree.
 */
describe('lexicon documents use only constructs the spec defines', () => {
  it('no string uses `pattern`', () => {
    // Not in the spec. `pub.chive.actor.profile` constrained `orcid` with one,
    // so that field accepted any string despite appearing to be validated.
    for (const { path, doc } of documents) {
      walk(doc.defs, path, (node, at) => {
        if (node.type === 'string') {
          expect(node, `${at} uses an unsupported \`pattern\``).not.toHaveProperty('pattern');
        }
      });
    }
  });

  it('no ref carries a `default`', () => {
    // The spec allows `default` on primitives only. On a ref it is dropped, so
    // `pub.chive.eprint.submission` promised a default publication status that
    // records never received.
    for (const { path, doc } of documents) {
      walk(doc.defs, path, (node, at) => {
        if (node.type === 'ref' || node.type === 'union') {
          expect(node, `${at} puts \`default\` on a ${node.type}`).not.toHaveProperty('default');
        }
      });
    }
  });

  it('no object declares `$type` as an ordinary property', () => {
    // `$type` is the protocol-level union discriminator; the runtime supplies
    // and checks it. Ten defs in pub.chive.richtext.* declared it themselves,
    // which made the generator emit it twice and produced a duplicate-identifier
    // error in every file it touched.
    for (const { path, doc } of documents) {
      walk(doc.defs, path, (node, at) => {
        if (node.properties) {
          expect(Object.keys(node.properties), `${at} declares $type`).not.toContain('$type');
        }
        if (node.required) {
          expect(node.required, `${at} requires $type`).not.toContain('$type');
        }
      });
    }
  });

  it('reads a non-trivial number of documents', () => {
    // Guards against the walk silently finding nothing.
    expect(documents.length).toBeGreaterThan(20);
  });
});
