/**
 * Subscriptions and recommendations from the standard.site graph.
 *
 * @remarks
 * A subscription is a reader's declaration, written into the reader's own
 * repository, that they follow a publication. Chive neither writes nor owns
 * them: it observes them on the firehose and indexes them so that the things
 * a subscription ought to produce -- a feed, a count, a notification -- have
 * something to be produced from.
 *
 * Before this existed, a Subscribe control on a Chive publication would have
 * written a record nothing on Chive read, promising the reader a capability
 * that did not exist. That is why the publication reference on eprint documents
 * was left as a plain URL until now.
 *
 * @packageDocumentation
 */

import type { IDatabasePool } from '../../types/interfaces/database.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * A subscription as Chive indexes it.
 *
 * @public
 */
export interface Subscription {
  readonly uri: string;
  readonly subscriberDid: string;
  readonly publicationUri: string;
  /** DID of the repository holding the publication: the author subscribed to. */
  readonly publicationDid: string;
  readonly createdAt?: Date;
}

/**
 * A recommendation of a document.
 *
 * @public
 */
export interface Recommendation {
  readonly uri: string;
  readonly recommenderDid: string;
  readonly documentUri: string;
  /** The eprint the document describes, when it could be resolved. */
  readonly eprintUri?: string;
  readonly createdAt?: Date;
}

/** Options for {@link SubscriptionService}. */
export interface SubscriptionServiceOptions {
  readonly db: IDatabasePool;
  readonly logger: ILogger;
}

/**
 * Indexes and answers questions about standard.site subscriptions.
 *
 * @public
 */
export class SubscriptionService {
  private readonly db: IDatabasePool;
  private readonly logger: ILogger;

  constructor(options: SubscriptionServiceOptions) {
    this.db = options.db;
    this.logger = options.logger.child({ service: 'SubscriptionService' });
  }

  /**
   * Records a subscription.
   *
   * @param subscription - The subscription as read from the firehose
   *
   * @remarks
   * Upserts, and clears any previous deletion: a reader who unsubscribes and
   * subscribes again writes a new record, and replaying the firehose must not
   * leave the older one marked deleted over the top of it.
   */
  async recordSubscription(subscription: Subscription): Promise<void> {
    await this.db.query(
      `INSERT INTO standard_site_subscriptions
         (uri, subscriber_did, publication_uri, publication_did, created_at, is_deleted, deleted_at)
       VALUES ($1, $2, $3, $4, $5, false, NULL)
       ON CONFLICT (uri) DO UPDATE SET
         subscriber_did = EXCLUDED.subscriber_did,
         publication_uri = EXCLUDED.publication_uri,
         publication_did = EXCLUDED.publication_did,
         created_at = EXCLUDED.created_at,
         is_deleted = false,
         deleted_at = NULL`,
      [
        subscription.uri,
        subscription.subscriberDid,
        subscription.publicationUri,
        subscription.publicationDid,
        subscription.createdAt ?? null,
      ]
    );

    this.logger.debug('Subscription indexed', {
      subscriber: subscription.subscriberDid,
      publication: subscription.publicationUri,
    });
  }

  /**
   * Marks a subscription withdrawn.
   *
   * @param uri - AT-URI of the subscription record that was deleted
   */
  async deleteSubscription(uri: string): Promise<void> {
    await this.db.query(
      `UPDATE standard_site_subscriptions
       SET is_deleted = true, deleted_at = NOW()
       WHERE uri = $1 AND is_deleted = false`,
      [uri]
    );
  }

  /**
   * Records a recommendation.
   *
   * @param recommendation - The recommendation as read from the firehose
   */
  async recordRecommendation(recommendation: Recommendation): Promise<void> {
    await this.db.query(
      `INSERT INTO standard_site_recommendations
         (uri, recommender_did, document_uri, eprint_uri, created_at, is_deleted, deleted_at)
       VALUES ($1, $2, $3, $4, $5, false, NULL)
       ON CONFLICT (uri) DO UPDATE SET
         recommender_did = EXCLUDED.recommender_did,
         document_uri = EXCLUDED.document_uri,
         eprint_uri = COALESCE(EXCLUDED.eprint_uri, standard_site_recommendations.eprint_uri),
         created_at = EXCLUDED.created_at,
         is_deleted = false,
         deleted_at = NULL`,
      [
        recommendation.uri,
        recommendation.recommenderDid,
        recommendation.documentUri,
        recommendation.eprintUri ?? null,
        recommendation.createdAt ?? null,
      ]
    );
  }

  /**
   * Marks a recommendation withdrawn.
   *
   * @param uri - AT-URI of the recommendation record that was deleted
   */
  async deleteRecommendation(uri: string): Promise<void> {
    await this.db.query(
      `UPDATE standard_site_recommendations
       SET is_deleted = true, deleted_at = NOW()
       WHERE uri = $1 AND is_deleted = false`,
      [uri]
    );
  }

  /**
   * Records a publication.
   *
   * @param publication - The publication as read from the firehose
   *
   * @remarks
   * A publication belongs to the repository holding it, so its author is the
   * DID in its own AT-URI. Indexed so that a profile can offer something to
   * subscribe to without querying the author's PDS on every view.
   */
  async recordPublication(publication: {
    uri: string;
    authorDid: string;
    name: string;
    url?: string;
    description?: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO standard_site_publications
         (uri, author_did, name, url, description, is_deleted)
       VALUES ($1, $2, $3, $4, $5, false)
       ON CONFLICT (uri) DO UPDATE SET
         author_did = EXCLUDED.author_did,
         name = EXCLUDED.name,
         url = EXCLUDED.url,
         description = EXCLUDED.description,
         is_deleted = false`,
      [
        publication.uri,
        publication.authorDid,
        publication.name,
        publication.url ?? null,
        publication.description ?? null,
      ]
    );
  }

  /**
   * Marks a publication removed.
   */
  async deletePublication(uri: string): Promise<void> {
    await this.db.query(`UPDATE standard_site_publications SET is_deleted = true WHERE uri = $1`, [
      uri,
    ]);
  }

  /**
   * The publication a reader would subscribe to for an author.
   *
   * @param authorDid - The author
   * @returns The publication's AT-URI, or undefined when they hold none
   *
   * @remarks
   * An author may hold several -- a blog and a paper feed, say. The oldest is
   * returned so the answer is stable: a reader who subscribed yesterday and
   * returns today must see the same publication they subscribed to, not a
   * newer one that makes the control read as unsubscribed.
   */
  async getPublicationUri(authorDid: string): Promise<string | undefined> {
    const result = await this.db.query<{ uri: string }>(
      `SELECT uri FROM standard_site_publications
       WHERE author_did = $1 AND is_deleted = false
       ORDER BY indexed_at ASC
       LIMIT 1`,
      [authorDid]
    );

    return result.rows[0]?.uri;
  }

  /**
   * Counts the readers subscribed to an author's publications.
   *
   * @param publicationDid - DID of the author
   * @returns How many distinct readers subscribe
   *
   * @remarks
   * Distinct readers, not records: an author may hold more than one
   * publication, and a reader subscribed to two of them is one follower.
   */
  async getSubscriberCount(publicationDid: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(DISTINCT subscriber_did) AS count
       FROM standard_site_subscriptions
       WHERE publication_did = $1 AND is_deleted = false`,
      [publicationDid]
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  /**
   * Reports whether a reader subscribes to an author.
   *
   * @param subscriberDid - The reader
   * @param publicationDid - DID of the author
   */
  async isSubscribed(subscriberDid: string, publicationDid: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM standard_site_subscriptions
         WHERE subscriber_did = $1 AND publication_did = $2 AND is_deleted = false
       ) AS exists`,
      [subscriberDid, publicationDid]
    );

    return result.rows[0]?.exists ?? false;
  }

  /**
   * The authors a reader follows.
   *
   * @param subscriberDid - The reader
   * @returns DIDs of the authors, deduplicated
   */
  async getSubscribedDids(subscriberDid: string): Promise<string[]> {
    const result = await this.db.query<{ publication_did: string }>(
      `SELECT DISTINCT publication_did
       FROM standard_site_subscriptions
       WHERE subscriber_did = $1 AND is_deleted = false`,
      [subscriberDid]
    );

    return result.rows.map((row) => row.publication_did);
  }

  /**
   * Counts the recommendations an eprint has received.  /**
   * Counts the recommendations an eprint has received.
   *
   * @param eprintUri - The eprint
   *
   * @remarks
   * Distinct recommenders rather than records, for the same reason as
   * subscribers: one person recommending a paper twice is one recommendation.
   */
  async getRecommendationCount(eprintUri: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(DISTINCT recommender_did) AS count
       FROM standard_site_recommendations
       WHERE eprint_uri = $1 AND is_deleted = false`,
      [eprintUri]
    );

    return Number(result.rows[0]?.count ?? 0);
  }
}
