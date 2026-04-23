/**
 * Loader for serving Chive's lexicon schemas as ATProto records.
 *
 * @remarks
 * Reads lexicon JSON files from the repo's `lexicons/` directory and
 * exposes them as `com.atproto.lexicon.schema` records. Enables PDSes
 * (and other ATProto clients) to resolve NSIDs in Chive's namespace via
 * the standard lexicon resolution protocol, without requiring us to
 * publish lexicons to a real PDS (which would make them immutable).
 *
 * @packageDocumentation
 * @public
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as dagCbor from '@ipld/dag-cbor';
import { CID } from 'multiformats/cid';
import * as Digest from 'multiformats/hashes/digest';

/** Chive's service DID that owns published lexicon schemas. */
export const CHIVE_LEXICON_DID = 'did:web:chive.pub';

/** Collection NSID for lexicon schema records. */
export const LEXICON_COLLECTION = 'com.atproto.lexicon.schema';

/** Sha-256 multicodec identifier. */
const SHA256_CODE = 0x12;
/** DAG-CBOR multicodec identifier. */
const DAG_CBOR_CODE = 0x71;

/**
 * Resolve the on-disk path to the repo's lexicons directory.
 *
 * @remarks
 * Checks `CHIVE_LEXICONS_DIR` env var first (for Docker), then falls back
 * to walking up from this module to find a sibling `lexicons/` directory.
 */
function resolveLexiconsDir(): string {
  if (process.env.CHIVE_LEXICONS_DIR) {
    return process.env.CHIVE_LEXICONS_DIR;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  // src/atproto/lexicon-server/ -> ../../../lexicons
  // dist/src/atproto/lexicon-server/ -> ../../../../lexicons
  const candidates = [
    resolve(here, '../../../lexicons'),
    resolve(here, '../../../../lexicons'),
    resolve(process.cwd(), 'lexicons'),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isDirectory()) return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error('Could not locate lexicons directory; set CHIVE_LEXICONS_DIR');
}

/** Lexicon schema record ready to serve via com.atproto.repo.getRecord. */
export interface LexiconRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

let lexiconCache: Map<string, LexiconRecord> | null = null;

/**
 * Load all lexicon JSON files from disk into memory as schema records.
 *
 * @remarks
 * Cached after first call. Each record is wrapped as a
 * `com.atproto.lexicon.schema` record with a computed CID over its
 * DAG-CBOR encoding.
 */
export function getLexiconRecords(): ReadonlyMap<string, LexiconRecord> {
  if (lexiconCache) return lexiconCache;

  const dir = resolveLexiconsDir();
  const cache = new Map<string, LexiconRecord>();

  for (const path of walkJsonFiles(dir)) {
    // Skip manifest and any non-schema helpers.
    if (path.endsWith('manifest.json')) continue;

    const raw = readFileSync(path, 'utf8');
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }

    const id = typeof doc.id === 'string' ? doc.id : null;
    if (!id) continue;
    if (typeof doc.lexicon !== 'number') continue;

    const value: Record<string, unknown> = {
      $type: LEXICON_COLLECTION,
      ...doc,
    };

    const bytes = dagCbor.encode(value);
    const hash = createHash('sha256').update(bytes).digest();
    const digest = Digest.create(SHA256_CODE, hash);
    const cid = CID.createV1(DAG_CBOR_CODE, digest);

    cache.set(id, {
      uri: `at://${CHIVE_LEXICON_DID}/${LEXICON_COLLECTION}/${id}`,
      cid: cid.toString(),
      value,
    });
  }

  lexiconCache = cache;
  return cache;
}

/** Look up a single lexicon record by its NSID. */
export function getLexiconRecord(nsid: string): LexiconRecord | undefined {
  return getLexiconRecords().get(nsid);
}

function* walkJsonFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walkJsonFiles(full);
    } else if (entry.endsWith('.json')) {
      yield full;
    }
  }
}
