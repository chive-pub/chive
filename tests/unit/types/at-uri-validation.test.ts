import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { toAtUri } from '@/types/atproto-validators.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function lexiconIds(dir: string, out: string[] = []): string[] {
  // `withFileTypes` answers from the directory entry itself. Reading the name
  // and then stat-ing it separately is a check-then-use on the filesystem, and
  // CodeQL flags it as such.
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) lexiconIds(full, out);
    else if (entry.name.endsWith('.json')) {
      const doc = JSON.parse(readFileSync(full, 'utf8')) as {
        id?: string;
        defs?: Record<string, { type?: string }>;
      };
      if (doc.id && doc.defs?.main?.type === 'record') out.push(doc.id);
    }
  }
  return out;
}

describe('toAtUri', () => {
  it('accepts a lowercase collection', () => {
    expect(toAtUri('at://did:plc:abc123/pub.chive.eprint.submission/xyz789')).not.toBeNull();
  });

  it('accepts a camelCase collection', () => {
    // The old pattern was `[a-z]+(\.[a-z]+)+`, lowercase-only, so it rejected
    // this and every other camelCase NSID.
    expect(toAtUri('at://did:plc:abc123/pub.chive.eprint.userTag/xyz789')).not.toBeNull();
  });

  it('accepts every record collection this repository defines', () => {
    // A validator that rejects the project's own record types is worse than no
    // validator, because a caller that trusts it drops valid URIs.
    const ids = lexiconIds(join(REPO_ROOT, 'lexicons'));
    expect(ids.length).toBeGreaterThan(10);

    for (const id of ids) {
      expect(toAtUri(`at://did:plc:abc123/${id}/3kabcd`), id).not.toBeNull();
    }
  });

  it('accepts a hyphenated domain authority', () => {
    expect(toAtUri('at://did:plc:abc/com.my-site.feed.post/3k')).not.toBeNull();
  });

  it('accepts the record-key characters the spec allows', () => {
    // `:` and `~` are legal in a record key and were rejected.
    expect(toAtUri('at://did:plc:abc/app.bsky.feed.post/a_b~c:d.e-f')).not.toBeNull();
  });

  it('accepts `self` as a key', () => {
    expect(toAtUri('at://did:plc:abc/pub.chive.actor.profile/self')).not.toBeNull();
  });

  it('rejects a URI that is not an at:// URI', () => {
    expect(toAtUri('https://example.com')).toBeNull();
  });

  it('rejects a single-segment collection', () => {
    expect(toAtUri('at://did:plc:abc/pub/xyz')).toBeNull();
  });

  it('rejects an empty record key', () => {
    expect(toAtUri('at://did:plc:abc/pub.chive.eprint.submission/')).toBeNull();
  });

  it('rejects a collection whose name segment starts with a digit', () => {
    // NSID name segments must begin with a letter.
    expect(toAtUri('at://did:plc:abc/pub.chive.9submission/xyz')).toBeNull();
  });

  it('rejects a missing collection', () => {
    expect(toAtUri('at://did:plc:abc/xyz')).toBeNull();
  });
});
