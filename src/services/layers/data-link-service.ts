/**
 * Reads Layers data links from the repository that holds them.
 *
 * @remarks
 * `pub.layers.eprint.dataLink` records associate an eprint with the Layers
 * datasets it produced -- a corpus, an annotation layer, an evaluation set, a
 * judgment study.
 *
 * They are written by the submitting author into that author's own repository,
 * which is what makes them readable without an index: the eprint's AT-URI names
 * the author, the author's DID document names their PDS, and the records are
 * one `com.atproto.repo.listRecords` away. No AppView is involved, and none
 * needs to be -- asking one was the reason this returned nothing for as long as
 * it did, since the Layers AppView is still in development and does not answer.
 *
 * Reading the author's repository rather than an index has a cost worth being
 * explicit about: only links the *eprint's own author* wrote are found. A third
 * party linking their dataset to someone else's paper is invisible here, and
 * stays so until Layers publishes an index that can be asked the reverse
 * question.
 *
 * @packageDocumentation
 */

import type { Redis } from 'ioredis';

import type { IIdentityResolver } from '../../types/interfaces/identity.interface.js';
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
  /** Resolves an author's DID to the PDS holding their repository. */
  readonly identity: IIdentityResolver;
  /** How long an answer stays cached, in seconds. */
  readonly cacheTtlSeconds?: number;
  /** How long to wait for a PDS before giving up, in milliseconds. */
  readonly timeoutMs?: number;
}

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
  private readonly identity: IIdentityResolver;
  private readonly cacheTtlSeconds: number;
  private readonly timeoutMs: number;

  constructor(options: LayersDataLinkServiceOptions) {
    this.redis = options.redis;
    this.logger = options.logger.child({ service: 'LayersDataLinkService' });
    this.identity = options.identity;
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

    const fetched = await this.fetchFromAuthorRepo(eprintUri);
    if (!fetched) return { dataLinks: [], source: 'unavailable' };

    const views = fetched.map((record) => toView(record)).filter((v): v is DataLinkView => !!v);

    // Cached even when empty: "this eprint has no linked data" is an answer
    // worth not asking for again on every page view.
    await this.writeCache(key, views);
    return { dataLinks: views, source: 'layers' };
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
   * Read the data links out of the eprint author's repository.
   *
   * @param eprintUri - AT-URI of the eprint, which names its author
   * @returns The records, or null when the repository could not be read
   *
   * @remarks
   * The eprint's AT-URI carries the author's DID, the DID document carries
   * their PDS, and the records sit in that repository under
   * `pub.layers.eprint.dataLink`. Nothing else is required -- in particular no
   * Layers AppView, which is still in development and answers nothing.
   *
   * The collection is read whole and filtered by `eprintUri` rather than
   * queried: `listRecords` has no predicate, and an author's dataLink
   * collection is proportional to the papers they have published, not to
   * anything unbounded.
   */
  private async fetchFromAuthorRepo(eprintUri: string): Promise<Record<string, unknown>[] | null> {
    const did = didFromAtUri(eprintUri);
    if (!did) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const pds = await this.identity.getPDSEndpoint(did as never);
      if (!pds) {
        this.logger.debug('No PDS for eprint author', { eprintUri });
        return null;
      }

      const url =
        `${pds.replace(/\/+$/, '')}/xrpc/com.atproto.repo.listRecords` +
        `?repo=${encodeURIComponent(did)}` +
        `&collection=${encodeURIComponent(DATA_LINK_COLLECTION)}` +
        `&limit=100`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        // An author with no dataLink records at all answers 200 with an empty
        // list, so a non-OK response is a real failure rather than an absence.
        this.logger.debug('Author PDS returned an error', {
          status: response.status,
          eprintUri,
        });
        return null;
      }

      const body = (await response.json()) as { records?: unknown };
      if (!Array.isArray(body.records)) {
        this.logger.warn('Author PDS returned an unexpected shape', { eprintUri });
        return null;
      }

      // One repository holds an author's links for every paper they have
      // written, so the ones for this eprint have to be picked out.
      return body.records.filter((record): record is Record<string, unknown> => {
        if (record === null || typeof record !== 'object') return false;
        const value = (record as { value?: unknown }).value;
        if (value === null || typeof value !== 'object') return false;
        return (value as { eprintUri?: unknown }).eprintUri === eprintUri;
      });
    } catch (error) {
      // Includes the abort. A reader must get the page whether or not another
      // service is reachable.
      this.logger.debug('Could not read data links from the author repository', {
        error: error instanceof Error ? error.message : String(error),
        eprintUri,
      });
      return null;
    } finally {
      // Without this a settled request leaves a live timer behind, one per
      // eprint view, each eventually aborting a controller nobody is listening
      // to any more.
      clearTimeout(timer);
    }
  }
}

/**
 * The collection an author's data links live in.
 */
const DATA_LINK_COLLECTION = 'pub.layers.eprint.dataLink';

/**
 * Extracts the repository DID from an AT-URI.
 *
 * @param uri - An AT-URI
 * @returns The DID, or null when the URI does not carry one
 */
function didFromAtUri(uri: string): string | null {
  const match = /^at:\/\/(did:[^/]+)\//.exec(uri);
  return match?.[1] ?? null;
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
