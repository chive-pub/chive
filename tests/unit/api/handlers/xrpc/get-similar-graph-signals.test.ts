/**
 * Tests that asking for co-citation does not cost you the citation results.
 *
 * @remarks
 * `findRelatedEprints` already runs the recommendation engine's co-citation and
 * bibliographic-coupling query and merges the answer into its weighted blend.
 * The handler used to run the same query a second time when a reader had those
 * signals enabled and append the results raw, scaled 0-1000. Those appended
 * copies outscored everything the blend had weighted, so turning the signals on
 * replaced the citation-derived suggestions with content similarity -- the
 * opposite of what asking for co-citation means.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { getSimilar } from '@/api/handlers/xrpc/discovery/getSimilar.js';

const URI = 'at://did:plc:a/pub.chive.eprint.submission/focus';

/** A blend result, as `findRelatedEprints` returns them. */
function blended(uri: string, score: number) {
  return {
    uri,
    title: `Title ${uri}`,
    score,
    relationshipType: 'cites' as const,
    explanation: 'Referenced by this paper',
    authors: [],
  };
}

function contextWith(recommendationService?: unknown) {
  const findRelatedEprints = vi.fn().mockResolvedValue([blended('at://x/c/1', 0.9)]);
  const getSimilarFromGraph = vi
    .fn()
    .mockResolvedValue([
      { uri: 'at://x/c/2', title: 'Graph result', similarity: 0.99, reason: 'co-citation' },
    ]);
  const services = {
    discovery: { findRelatedEprints },
    eprint: { getEprint: vi.fn().mockResolvedValue({ uri: URI, title: 'Focus' }) },
    ...(recommendationService === undefined
      ? { recommendationService: { getSimilar: getSimilarFromGraph } }
      : {}),
  };
  const c = {
    get: (key: string) => {
      if (key === 'logger') return { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
      if (key === 'services') return services;
      return undefined;
    },
  };
  return { c, findRelatedEprints, getSimilarFromGraph };
}

type HandlerArgs = Parameters<typeof getSimilar.handler>[0];

describe('getSimilar with graph signals requested', () => {
  it('keeps the citation-derived suggestions', async () => {
    const { c } = contextWith();
    const response = await getSimilar.handler({
      params: { uri: URI, limit: 5, includeTypes: ['citation', 'co-citation'] },
      c,
    } as unknown as HandlerArgs);

    const explanations = response.body.related.map((r) => r.explanation);
    expect(explanations).toContain('Referenced by this paper');
  });

  it('does not run the recommendation engine a second time', async () => {
    // The blend already asked it. A second pass returned the same papers on an
    // unweighted scale that outranked everything else.
    const { c, getSimilarFromGraph } = contextWith();
    await getSimilar.handler({
      params: { uri: URI, limit: 5, includeTypes: ['citation', 'co-citation'] },
      c,
    } as unknown as HandlerArgs);

    expect(getSimilarFromGraph).not.toHaveBeenCalled();
  });

  it('gives the same answer whether or not the graph signals are asked for', async () => {
    const withGraph = await getSimilar.handler({
      params: {
        uri: URI,
        limit: 5,
        includeTypes: ['citation', 'co-citation', 'bibliographic-coupling'],
      },
      c: contextWith().c,
    } as unknown as HandlerArgs);
    const without = await getSimilar.handler({
      params: { uri: URI, limit: 5, includeTypes: ['citation'] },
      c: contextWith().c,
    } as unknown as HandlerArgs);

    expect(withGraph.body.related.map((r) => r.uri)).toEqual(
      without.body.related.map((r) => r.uri)
    );
  });

  it('still passes the standard signals through to the blend', async () => {
    const { c, findRelatedEprints } = contextWith();
    await getSimilar.handler({
      params: { uri: URI, limit: 5, includeTypes: ['citation', 'semantic', 'co-citation'] },
      c,
    } as unknown as HandlerArgs);

    expect(findRelatedEprints).toHaveBeenCalledWith(
      URI,
      expect.objectContaining({ signals: expect.arrayContaining(['citations', 'semantic']) })
    );
  });

  it('accepts a stored co-citation setting without erroring', async () => {
    const { c } = contextWith();
    const response = await getSimilar.handler({
      params: { uri: URI, limit: 5, includeTypes: ['co-citation'] },
      c,
    } as unknown as HandlerArgs);
    expect(response.body.related).toBeInstanceOf(Array);
  });
});
