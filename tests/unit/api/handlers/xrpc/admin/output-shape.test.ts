/**
 * Validates that admin handlers return what their lexicons require.
 *
 * @remarks
 * The XRPC router runs with `validateOutput: true`, so a response missing a
 * field its lexicon lists as required is not a cosmetic mismatch — it throws
 * `InternalServerError` and the admin page gets a 500. Four endpoints were
 * failing this way at once:
 *
 * - `getGraphStats` returned `totalNodes`/`totalEdges` where the lexicon
 *   required `nodeCount`/`edgeCount`, neither of which anything produced.
 * - `getSearchAnalytics` returned `totalQueries` where the lexicon required
 *   `totalSearches`.
 * - `listWarnings` and `listViolations` returned only their rows, while their
 *   lexicons required a `total` that the service never computed and no page
 *   ever read.
 *
 * These assertions run the real validator against the shapes the handlers and
 * services actually build.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { lexicons } from '../../../../../../src/lexicons/generated/lexicons.js';

/**
 * Asserts a body passes the lexicon's output validation.
 */
function expectValid(nsid: string, body: unknown): void {
  expect(() => {
    lexicons.assertValidXrpcOutput(nsid, body);
  }).not.toThrow();
}

describe('admin handler output shapes', () => {
  it('getGraphStats returns the counts the handler builds', () => {
    expectValid('pub.chive.admin.getGraphStats', {
      totalNodes: 1,
      totalEdges: 2,
      fieldNodes: 3,
      authorNodes: 4,
      institutionNodes: 5,
      pendingProposals: 6,
    });
  });

  it('getSearchAnalytics accepts the service shape, float ratio and all', () => {
    // `ctr` is clicks/impressions and `avgDwellTimeMs` is null until something
    // has been measured. Lexicon has no float type and a declared integer
    // rejects both, so neither is declared; undeclared properties validate and
    // still reach the client.
    expectValid('pub.chive.admin.getSearchAnalytics', {
      totalQueries: 12,
      totalClicks: 3,
      impressions: 40,
      clicks: 3,
      ctr: 0.075,
      avgDwellTimeMs: null,
      positionDistribution: [{ position: 1, count: 9 }],
      topQueries: [{ query: 'semantics', impressionCount: 5, clickCount: 2 }],
      zeroResultCount: 1,
      relevanceGradeDistribution: [{ relevanceGrade: 2, count: 4 }],
      timestamp: '2026-09-01T00:00:00.000Z',
    });
  });

  it('getSearchAnalytics accepts a measured dwell time too', () => {
    expectValid('pub.chive.admin.getSearchAnalytics', {
      totalQueries: 1,
      totalClicks: 1,
      impressions: 1,
      clicks: 1,
      ctr: 1,
      avgDwellTimeMs: 1234.5,
      positionDistribution: [],
      topQueries: [],
      zeroResultCount: 0,
      relevanceGradeDistribution: [],
      timestamp: '2026-09-01T00:00:00.000Z',
    });
  });

  it.each([
    ['pub.chive.admin.listWarnings', { warnings: [] }],
    ['pub.chive.admin.listViolations', { violations: [] }],
  ])('%s returns just its rows', (nsid, body) => {
    expectValid(nsid, body);
  });
});

describe('output validation is actually enforced', () => {
  it('rejects a body missing a required field', () => {
    // If this ever stops throwing, the tests above stop meaning anything.
    expect(() => {
      lexicons.assertValidXrpcOutput('pub.chive.admin.getGraphStats', { totalNodes: 1 });
    }).toThrow();
  });

  it('rejects a float where the lexicon declares an integer', () => {
    // This is why `ctr` is left undeclared rather than typed as an integer.
    expect(() => {
      lexicons.assertValidXrpcOutput('pub.chive.admin.getGraphStats', {
        totalNodes: 1.5,
        totalEdges: 2,
        fieldNodes: 3,
        authorNodes: 4,
        institutionNodes: 5,
        pendingProposals: 6,
      });
    }).toThrow();
  });
});
