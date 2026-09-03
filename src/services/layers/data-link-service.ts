/**
 * Federated reads of Layers data links.
 *
 * @remarks
 * `pub.layers.eprint.dataLink` records associate an eprint with the Layers
 * datasets it produced — a corpus, an annotation layer, an evaluation set, a
 * judgment study. They live in their authors' repositories and the Layers
 * AppView is authoritative for them.
 *
 * A link names its data in one of three ways, and which one is present depends
 * on how the dataset is built rather than on the publisher's preference:
 * `catalogRef` for the dataset as a whole, `corpusRef` when it is a corpus, and
 * `experimentRefs` for judgment studies. A dataset made of expressions and
 * judgments has no corpus record, so `catalogRef` is the general case and
 * `corpusRef` the special one.
 *
 * Chive asks Layers rather than indexing the collection itself. Each AppView
 * stays authoritative for its own records, Chive's view cannot drift from
 * Layers', and no change to the firehose filter is needed. The cost is that
 * these links are not searchable from Chive and the panel depends on Layers
 * being reachable — which is why every failure here degrades to an empty list
 * rather than an error.
 *
 * That degradation is the common case today, not a rare one: `api.layers.pub`
 * does not currently answer. An eprint page must render exactly as well when
 * Layers is absent as when it is present.
 *
 * @packageDocumentation
 */

import type { Redis } from 'ioredis';

import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * A data link as Chive presents it.
 *
 * @public
 */
export interface DataLinkView {
  readonly uri: string;
  readonly dataKind: string;
  readonly dataKindUri?: string;
  readonly description?: string;
  readonly paperSection?: string;
  /**
   * The dataset as a whole.
   *
   * @remarks
   * `pub.layers.catalog.collection` is Layers' citable artifact for a dataset.
   * It is the general case: a dataset built from judgments or expressions has
   * no corpus record at all, so {@link DataLinkView.corpusRef} cannot name it.
   */
  readonly catalogRef?: string;
  /** The corpus, when the dataset is one. */
  readonly corpusRef?: string;
  /** `pub.layers.judgment.experimentDef` records behind the eprint. */
  readonly experimentRefs?: string[];
  readonly createdAt?: string;
}

/**
 * Where an answer came from.
 *
 * @remarks
 * A client cannot otherwise tell "this eprint has no linked data" from "Layers
 * did not answer", and those mean different things to a reader.
 *
 * @public
 */
export type DataLinkSource = 'layers' | 'cache' | 'unavailable';

/** Result of a data link lookup. */
export interface DataLinkResult {
  readonly dataLinks: DataLinkView[];
  readonly source: DataLinkSource;
}

/** Options for {@link LayersDataLinkService}. */
export interface LayersDataLinkServiceOptions {
  readonly redis: Redis;
  readonly logger: ILogger;
  /** Base URL of the Layers AppView. */
  readonly appViewUrl?: string;
  /** How long an answer stays cached, in seconds. */
  readonly cacheTtlSeconds?: number;
  /** How long to wait for Layers before giving up, in milliseconds. */
  readonly timeoutMs?: number;
}

const DEFAULT_APPVIEW_URL = 'https://api.layers.pub';
const DEFAULT_CACHE_TTL_SECONDS = 300;

/**
 * Short on purpose.
 *
 * @remarks
 * This call sits on an eprint page render. A slow or absent Layers must cost a
 * reader a fraction of a second, not the several seconds a default fetch would
 * spend before giving up.
 */
const DEFAULT_TIMEOUT_MS = 2000;

/** Cache key prefix, namespaced so it cannot collide with Chive's own records. */
const CACHE_PREFIX = 'chive:layers:datalinks:';

/**
 * Reads Layers data links for an eprint.
 *
 * @public
 */
export class LayersDataLinkService {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly appViewUrl: string;
  private readonly cacheTtlSeconds: number;
  private readonly timeoutMs: number;

  constructor(options: LayersDataLinkServiceOptions) {
    this.redis = options.redis;
    this.logger = options.logger.child({ service: 'LayersDataLinkService' });
    this.appViewUrl = (options.appViewUrl ?? DEFAULT_APPVIEW_URL).replace(/\/+$/, '');
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * List the Layers datasets linked to an eprint.
   *
   * @param eprintUri - AT-URI of the eprint
   * @returns The links and where they came from; never throws
   *
   * @remarks
   * Every failure path returns `unavailable` with an empty list. A reader
   * should see an eprint page whether or not another service is up, and a
   * caller should be able to tell that from a genuine absence of links.
   */
  async listForEprint(eprintUri: string): Promise<DataLinkResult> {
    const key = `${CACHE_PREFIX}${eprintUri}`;

    const cached = await this.readCache(key);
    if (cached) return { dataLinks: cached, source: 'cache' };

    const fetched = await this.fetchFromLayers(eprintUri);
    if (!fetched) return { dataLinks: [], source: 'unavailable' };

    // Cached even when empty: "this eprint has no linked data" is an answer
    // worth not asking for again on every page view.
    await this.writeCache(key, fetched);
    return { dataLinks: fetched, source: 'layers' };
  }

  private async readCache(key: string): Promise<DataLinkView[] | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as DataLinkView[];
    } catch (error) {
      // A corrupt or unreachable cache must not stop the fetch behind it.
      this.logger.debug('Data link cache read failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async writeCache(key: string, links: DataLinkView[]): Promise<void> {
    try {
      await this.redis.setex(key, this.cacheTtlSeconds, JSON.stringify(links));
    } catch (error) {
      this.logger.debug('Data link cache write failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Ask the Layers AppView.
   *
   * @returns The records, or null when Layers could not be reached or answered
   * with something unusable
   */
  private async fetchFromLayers(eprintUri: string): Promise<DataLinkView[] | null> {
    const url =
      `${this.appViewUrl}/xrpc/pub.layers.eprint.listDataLinks` +
      `?eprintUri=${encodeURIComponent(eprintUri)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        this.logger.debug('Layers AppView returned an error', {
          status: response.status,
          eprintUri,
        });
        return null;
      }

      const body = (await response.json()) as { records?: unknown };
      if (!Array.isArray(body.records)) {
        this.logger.warn('Layers AppView returned an unexpected shape', { eprintUri });
        return null;
      }

      return body.records.map((record) => toView(record)).filter((v): v is DataLinkView => !!v);
    } catch (error) {
      // Includes the abort. Debug rather than warn: with Layers not yet
      // deployed this is the ordinary case, and logging it loudly on every
      // eprint view would bury real problems.
      this.logger.debug('Layers AppView unreachable', {
        error: error instanceof Error ? error.message : String(error),
        eprintUri,
      });
      return null;
    } finally {
      // Without this a settled request leaves a live two-second timer behind,
      // one per eprint view, each one holding the event loop and eventually
      // aborting a controller nobody is listening to any more.
      clearTimeout(timer);
    }
  }
}

/**
 * Convert one Layers record into Chive's view of it.
 *
 * @param record - A record from the Layers AppView
 * @returns The view, or null when the record lacks what a reader needs
 *
 * @remarks
 * Only `uri` and `dataKind` are required. A link with neither identifies
 * nothing and describes nothing, so it is dropped rather than rendered as a
 * blank row. Everything else is optional in Layers' own lexicon and is passed
 * through when present.
 */
function toView(record: unknown): DataLinkView | null {
  if (record === null || typeof record !== 'object') return null;

  const r = record as Record<string, unknown>;
  const value = (r.value ?? r) as Record<string, unknown>;

  const uri = typeof r.uri === 'string' ? r.uri : undefined;
  const dataKind = typeof value.dataKind === 'string' ? value.dataKind : undefined;

  if (!uri || !dataKind) return null;

  const optional = (key: string): string | undefined =>
    typeof value[key] === 'string' ? value[key] : undefined;

  const uriList = (key: string): string[] | undefined => {
    const value_ = value[key];
    if (!Array.isArray(value_)) return undefined;
    const items = value_.filter((item): item is string => typeof item === 'string');
    return items.length > 0 ? items : undefined;
  };

  return {
    uri,
    dataKind,
    dataKindUri: optional('dataKindUri'),
    description: optional('description'),
    paperSection: optional('paperSection'),
    catalogRef: optional('catalogRef'),
    corpusRef: optional('corpusRef'),
    experimentRefs: uriList('experimentRefs'),
    createdAt: optional('createdAt'),
  };
}
