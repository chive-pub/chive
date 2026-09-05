/**
 * Tests for pub.chive.discovery.getCitationNetwork.
 *
 * @remarks
 * The graph stores only URIs on its nodes, so the handler's real work is
 * naming both ends of every edge -- the omission that had the old network view
 * drawing boxes labelled "Citing paper 1". The other thing worth holding is
 * that it does not claim the focus paper is in a network it is absent from: a
 * client told otherwise draws a focused node with nothing attached and no way
 * to tell that from a load that failed.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { getCitationNetwork } from '@/api/handlers/xrpc/discovery/getCitationNetwork.js';

const FOCUS = 'at://did:plc:a/pub.chive.eprint.submission/focus';
const OTHER = 'at://did:plc:b/pub.chive.eprint.submission/other';

interface Edge {
  citingUri: string;
  citedUri: string;
  isInfluential?: boolean;
}

function ref(uri: string, extras: Record<string, unknown> = {}) {
  return { uri, title: `Title of ${uri}`, authors: ['Ada Lovelace'], ...extras };
}

/** A context carrying a discovery service that answers with these edges. */
function contextWith(options: {
  citations?: Edge[];
  total?: number;
  truncated?: boolean;
  refs?: Map<string, ReturnType<typeof ref>>;
  discovery?: unknown;
}) {
  const getCitationNetworkMock = vi.fn().mockResolvedValue({
    citations: options.citations ?? [],
    total: options.total ?? options.citations?.length ?? 0,
    truncated: options.truncated ?? false,
  });
  const getEprintRefs = vi.fn().mockResolvedValue(options.refs ?? new Map());

  const discovery =
    'discovery' in options
      ? options.discovery
      : { getCitationNetwork: getCitationNetworkMock, getEprintRefs };

  const c = {
    get: (key: string) => {
      if (key === 'logger') return { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
      if (key === 'services') return { discovery };
      return undefined;
    },
  };

  return { c, getCitationNetworkMock, getEprintRefs };
}

// The handler takes a context shaped by the XRPC router; the tests supply the
// two things it actually reads.
type HandlerArgs = Parameters<typeof getCitationNetwork.handler>[0];

describe('getCitationNetwork', () => {
  it('names both ends of every edge', async () => {
    const { c } = contextWith({
      citations: [{ citingUri: OTHER, citedUri: FOCUS }],
      refs: new Map([
        [FOCUS, ref(FOCUS, { year: 2014, venue: 'NELS', doi: '10.1/x' })],
        [OTHER, ref(OTHER)],
      ]),
    });

    const response = await getCitationNetwork.handler({ params: { uri: FOCUS }, c } as HandlerArgs);

    expect(response.body.papers).toHaveLength(2);
    expect(response.body.papers?.find((p) => p.uri === FOCUS)).toMatchObject({
      title: `Title of ${FOCUS}`,
      authors: ['Ada Lovelace'],
      year: 2014,
      venue: 'NELS',
      doi: '10.1/x',
    });
  });

  it('asks for each paper once, however many edges it sits on', async () => {
    // In a network a paper is commonly at the end of many edges. Repeating its
    // author list per edge sends the same names back dozens of times.
    const { c, getEprintRefs } = contextWith({
      citations: [
        { citingUri: OTHER, citedUri: FOCUS },
        { citingUri: FOCUS, citedUri: OTHER },
      ],
    });

    await getCitationNetwork.handler({ params: {}, c } as HandlerArgs);

    expect(getEprintRefs).toHaveBeenCalledTimes(1);
  });

  it('echoes the focus when it is in the network', async () => {
    const { c } = contextWith({ citations: [{ citingUri: OTHER, citedUri: FOCUS }] });
    const response = await getCitationNetwork.handler({ params: { uri: FOCUS }, c } as HandlerArgs);
    expect(response.body.focusUri).toBe(FOCUS);
  });

  it('does not claim a focus that has no citations either way', async () => {
    const { c } = contextWith({ citations: [{ citingUri: 'x', citedUri: 'y' }] });
    const response = await getCitationNetwork.handler({ params: { uri: FOCUS }, c } as HandlerArgs);
    expect(response.body.focusUri).toBeUndefined();
  });

  it('passes the focus, limit and filter through to the graph', async () => {
    const { c, getCitationNetworkMock } = contextWith({});
    await getCitationNetwork.handler({
      params: { uri: FOCUS, limit: 42, onlyInfluential: true },
      c,
    } as HandlerArgs);

    expect(getCitationNetworkMock).toHaveBeenCalledWith({
      focusUri: FOCUS,
      limit: 42,
      onlyInfluential: true,
    });
  });

  it('asks for the whole network when no paper is named', async () => {
    const { c, getCitationNetworkMock } = contextWith({});
    await getCitationNetwork.handler({ params: {}, c } as HandlerArgs);
    expect(getCitationNetworkMock).toHaveBeenCalledWith({});
  });

  it('reports the network size and whether it was cut short', async () => {
    const { c } = contextWith({
      citations: [{ citingUri: OTHER, citedUri: FOCUS }],
      total: 900,
      truncated: true,
    });
    const response = await getCitationNetwork.handler({ params: {}, c } as HandlerArgs);
    expect(response.body.totalCitations).toBe(900);
    expect(response.body.truncated).toBe(true);
  });

  it('carries the influential marker through, and omits it when absent', async () => {
    const { c } = contextWith({
      citations: [
        { citingUri: OTHER, citedUri: FOCUS, isInfluential: true },
        { citingUri: FOCUS, citedUri: OTHER },
      ],
    });
    const response = await getCitationNetwork.handler({ params: {}, c } as HandlerArgs);
    expect(response.body.citations[0]).toMatchObject({ isInfluential: true });
    expect(response.body.citations[1]).not.toHaveProperty('isInfluential');
  });

  it('answers an empty network rather than failing', async () => {
    const { c } = contextWith({ citations: [] });
    const response = await getCitationNetwork.handler({ params: {}, c } as HandlerArgs);
    expect(response.body).toMatchObject({ papers: [], citations: [], truncated: false });
  });

  it('refuses when the discovery service is not available', async () => {
    const { c } = contextWith({ discovery: undefined });
    await expect(getCitationNetwork.handler({ params: {}, c } as HandlerArgs)).rejects.toThrow(
      /discovery/i
    );
  });

  it('is readable without signing in', () => {
    // A citation network nobody can see without an account is not a citation
    // network anyone will look at.
    expect(getCitationNetwork.auth).toBe('optional');
  });
});
