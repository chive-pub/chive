import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { LayersDataLinkService } from '@/services/layers/data-link-service.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

function createLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

function createRedis(): {
  store: Map<string, string>;
  get: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
} {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    setex: vi.fn((k: string, _ttl: number, v: string) => {
      store.set(k, v);
      return Promise.resolve('OK');
    }),
  };
}

const EPRINT = 'at://did:plc:author/pub.chive.eprint.submission/abc';

/**
 * The author's PDS, resolved from the DID in the eprint's AT-URI.
 *
 * Data links live in the submitting author's own repository, so this is the
 * only lookup the service needs -- there is no AppView in the path.
 */
function createIdentity(pds: string | null = 'https://pds.example'): {
  getPDSEndpoint: ReturnType<typeof vi.fn>;
} {
  return { getPDSEndpoint: vi.fn().mockResolvedValue(pds) };
}

function build(
  redis: ReturnType<typeof createRedis>,
  overrides: Record<string, unknown> = {}
): LayersDataLinkService {
  return new LayersDataLinkService({
    redis: redis as never,
    logger: createLogger(),
    identity: createIdentity() as never,
    ...overrides,
  });
}

function layersRecord(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uri: 'at://did:plc:someone/pub.layers.eprint.dataLink/1',
    value: { eprintUri: EPRINT, dataKind: 'corpus', paperSection: 'Table 3', ...over },
  };
}

describe('LayersDataLinkService', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns the links Layers reports', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [layersRecord()] }),
    }) as never;

    const result = await build(createRedis()).listForEprint(EPRINT);

    expect(result.source).toBe('layers');
    expect(result.dataLinks).toHaveLength(1);
    expect(result.dataLinks[0]).toMatchObject({ dataKind: 'corpus', paperSection: 'Table 3' });
  });

  it('passes through every field a real Layers record carries', async () => {
    // Pinned against `pub.layers.eprint.dataLink` and the `#recordView` wrapper
    // in Layers' published lexicon, with each optional field populated.
    // `corpusRef` matters most: it is what tells the eprint page a link names a
    // dataset that can actually be loaded, and it gates the `lairs` snippet
    // entirely. A link that loses it renders as a bare label.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          records: [
            {
              uri: 'at://did:plc:someone/pub.layers.eprint.dataLink/3l7abc',
              cid: 'bafyreiabc123',
              value: {
                $type: 'pub.layers.eprint.dataLink',
                eprintUri: EPRINT,
                eprintDid: 'did:plc:someone',
                dataKind: 'annotation-layer',
                dataKindUri: 'at://did:plc:graph/pub.chive.graph.node/annotation-layer',
                catalogRef: 'at://did:plc:layers/pub.layers.catalog.collection/ewt-eng-uds',
                corpusRef: 'at://did:plc:layers/pub.layers.corpus.corpus/f2e9e06a',
                experimentRefs: ['at://did:plc:layers/pub.layers.judgment.experimentDef/exp1'],
                description: 'Veridicality judgments for every clause-embedding verb.',
                paperSection: 'Table 3',
                createdAt: '2026-09-01T12:00:00.000Z',
              },
            },
          ],
        }),
    }) as never;

    const result = await build(createRedis()).listForEprint(EPRINT);

    expect(result.source).toBe('layers');
    expect(result.dataLinks[0]).toEqual({
      uri: 'at://did:plc:someone/pub.layers.eprint.dataLink/3l7abc',
      dataKind: 'annotation-layer',
      dataKindUri: 'at://did:plc:graph/pub.chive.graph.node/annotation-layer',
      catalogRef: 'at://did:plc:layers/pub.layers.catalog.collection/ewt-eng-uds',
      corpusRef: 'at://did:plc:layers/pub.layers.corpus.corpus/f2e9e06a',
      experimentRefs: ['at://did:plc:layers/pub.layers.judgment.experimentDef/exp1'],
      description: 'Veridicality judgments for every clause-embedding verb.',
      paperSection: 'Table 3',
      createdAt: '2026-09-01T12:00:00.000Z',
    });
  });

  it('reports an unreachable Layers as unavailable, not as no links', async () => {
    // A reader should be able to tell "this eprint has no data" from "we could
    // not ask". A PDS can be slow or unreachable, so this is the
    // ordinary path today rather than an edge case.
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as never;

    const result = await build(createRedis()).listForEprint(EPRINT);

    expect(result.source).toBe('unavailable');
    expect(result.dataLinks).toEqual([]);
  });

  it('never throws, whatever Layers does', async () => {
    const behaviours = [
      (): Promise<never> => Promise.reject(new Error('network')),
      (): Promise<unknown> =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
      (): Promise<unknown> =>
        Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) }),
      (): Promise<unknown> =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ records: 'not an array' }) }),
    ];

    for (const behaviour of behaviours) {
      global.fetch = vi.fn(behaviour) as never;
      await expect(build(createRedis()).listForEprint(EPRINT)).resolves.toMatchObject({
        source: 'unavailable',
        dataLinks: [],
      });
    }
  });

  it('does not cache an unavailable answer', async () => {
    // Caching a failure would keep the panel empty for the whole TTL after
    // Layers came back.
    const redis = createRedis();
    global.fetch = vi.fn().mockRejectedValue(new Error('down')) as never;

    await build(redis).listForEprint(EPRINT);

    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('caches an empty answer, which is a real answer', async () => {
    const redis = createRedis();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    }) as never;

    await build(redis).listForEprint(EPRINT);

    expect(redis.setex).toHaveBeenCalled();
  });

  it('serves a second request from cache without asking Layers again', async () => {
    const redis = createRedis();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [layersRecord()] }),
    });
    global.fetch = fetchMock as never;

    const service = build(redis);
    await service.listForEprint(EPRINT);
    const second = await service.listForEprint(EPRINT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.source).toBe('cache');
  });

  it('gives up quickly rather than holding a page render', async () => {
    // `fetch`'s own default would spend far longer before failing, on a call
    // that sits on an eprint page render.
    const redis = createRedis();
    global.fetch = vi.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    ) as never;

    const started = Date.now();
    const result = await build(redis, { timeoutMs: 50 }).listForEprint(EPRINT);

    expect(result.source).toBe('unavailable');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('carries a dataset that has no corpus record', async () => {
    // MegaAcceptability is expressions and judgments with no corpus account, so
    // `corpusRef` cannot name it and `catalogRef` is the only pointer to the
    // dataset. Dropping it would leave the link naming nothing loadable.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          records: [
            layersRecord({
              dataKind: 'judgments',
              catalogRef: 'at://did:plc:mega/pub.layers.catalog.collection/acceptability-eng',
            }),
          ],
        }),
    }) as never;

    const result = await build(createRedis()).listForEprint(EPRINT);

    expect(result.dataLinks[0]?.catalogRef).toBe(
      'at://did:plc:mega/pub.layers.catalog.collection/acceptability-eng'
    );
    expect(result.dataLinks[0]?.corpusRef).toBeUndefined();
  });

  it('ignores an experimentRefs value that is not a list of uris', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [layersRecord({ experimentRefs: 'not-a-list' })] }),
    }) as never;

    const result = await build(createRedis()).listForEprint(EPRINT);

    expect(result.dataLinks).toHaveLength(1);
    expect(result.dataLinks[0]?.experimentRefs).toBeUndefined();
  });

  it('drops a record that identifies nothing', async () => {
    // Without a uri or a dataKind there is nothing to link to and nothing to
    // label, so rendering it would produce a blank row.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          records: [layersRecord(), { uri: 'at://x/y/z', value: {} }, { value: { dataKind: 'c' } }],
        }),
    }) as never;

    const result = await build(createRedis()).listForEprint(EPRINT);

    expect(result.dataLinks).toHaveLength(1);
  });

  it('namespaces its cache keys', async () => {
    const redis = createRedis();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    }) as never;

    await build(redis).listForEprint(EPRINT);

    expect([...redis.store.keys()][0]).toMatch(/^chive:layers:datalinks:/);
  });

  it("reads the collection from the eprint author's own repository", async () => {
    // No AppView is in the path. The eprint's AT-URI names the author, the DID
    // document names their PDS, and the records are one listRecords away.
    const identity = createIdentity('https://pds.example/');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    }) as never;

    await build(createRedis(), { identity: identity as never }).listForEprint(EPRINT);

    expect(identity.getPDSEndpoint).toHaveBeenCalledWith('did:plc:author');
    const url = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain('https://pds.example/xrpc/com.atproto.repo.listRecords');
    expect(url).toContain('repo=did%3Aplc%3Aauthor');
    expect(url).toContain('collection=pub.layers.eprint.dataLink');
  });

  it('returns only the links belonging to this eprint', async () => {
    // One repository holds an author's links for every paper they have written.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          records: [
            layersRecord(),
            layersRecord({ eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/other' }),
          ],
        }),
    }) as never;

    const result = await build(createRedis()).listForEprint(EPRINT);

    expect(result.dataLinks).toHaveLength(1);
  });

  it('reports an author with no resolvable PDS as unavailable', async () => {
    const result = await build(createRedis(), {
      identity: createIdentity(null) as never,
    }).listForEprint(EPRINT);

    expect(result.source).toBe('unavailable');
  });

  it('clears the abort timer once a request settles', async () => {
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    }) as never;

    await build(createRedis()).listForEprint(EPRINT);

    // A timer left behind holds the event loop and eventually aborts a
    // controller nobody is listening to, once per eprint view.
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('clears the abort timer when the request fails too', async () => {
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as never;

    await build(createRedis()).listForEprint(EPRINT);

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
