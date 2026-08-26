/**
 * Unit tests for the relaxed rate-limit path list.
 *
 * @remarks
 * Autocomplete and search endpoints get a higher anonymous rate limit than
 * everything else, selected by matching request paths against a hardcoded list
 * of prefixes. One entry named `pub.chive.search.searchSubmissions`, which is
 * not a method this service registers — the real NSID is
 * `pub.chive.eprint.searchSubmissions` — so search never matched the relaxed
 * tier and every anonymous search was billed against the low one.
 *
 * A stale NSID in a list of strings fails silently: nothing errors, the pattern
 * simply never matches. Checking the list against the registered methods is the
 * only way this stays true as endpoints are renamed.
 */

import { describe, it, expect } from 'vitest';

import { AUTOCOMPLETE_RATE_LIMIT_PATHS } from '@/api/rate-limit-paths.js';
import { schemas } from '@/lexicons/generated/lexicons.js';

const LEXICON_IDS = new Set(schemas.map((schema) => schema.id));

const XRPC_PREFIX = '/xrpc/';

const xrpcNsids = AUTOCOMPLETE_RATE_LIMIT_PATHS.filter((path) => path.startsWith(XRPC_PREFIX)).map(
  (path) => path.slice(XRPC_PREFIX.length)
);

describe('relaxed rate-limit paths', () => {
  it('lists at least one XRPC endpoint', () => {
    expect(xrpcNsids.length).toBeGreaterThan(0);
  });

  // Checked against the lexicon set rather than the handler registry: importing
  // the registry pulls every XRPC handler into this test's module graph, which
  // drags several thousand untested lines into the coverage denominator for no
  // extra assurance. A path naming an NSID that has no lexicon is the defect.
  it.each(xrpcNsids)('%s names a real lexicon', (nsid) => {
    expect(LEXICON_IDS).toContain(nsid);
  });

  // The specific regression: the search endpoint must be in the relaxed tier.
  it('covers the eprint search endpoint under its real NSID', () => {
    expect(AUTOCOMPLETE_RATE_LIMIT_PATHS).toContain('/xrpc/pub.chive.eprint.searchSubmissions');
  });

  it('no longer references the NSID that never existed', () => {
    expect(AUTOCOMPLETE_RATE_LIMIT_PATHS).not.toContain('/xrpc/pub.chive.search.searchSubmissions');
  });
});
