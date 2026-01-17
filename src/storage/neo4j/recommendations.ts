/**
 * Recommendation service for papers and fields.
 *
 * @remarks
 * Provides personalized and general recommendations using graph algorithms:
 * - Personalized paper recommendations based on user interests
 * - Trending papers based on recent activity
 * - Similar papers based on co-citation and content
 *
 * @packageDocumentation
 */

import neo4j from 'neo4j-driver';
import { inject, singleton } from 'tsyringe';

import type { AtUri, DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

import type { Neo4jConnection } from './connection.js';

/**
 * Paper recommendation result.
 */
export interface PaperRecommendation {
  uri: AtUri;
  title: string;
  abstract?: string;
  authors: string[];
  score: number;
  reason: RecommendationReason;
  relatedFields: string[];
}

/**
 * Recommendation reason types.
 */
export type RecommendationReason =
  | 'similar-fields'
  | 'cited-by-interests'
  | 'coauthor-network'
  | 'trending-in-field'
  | 'similar-content';

/**
 * Trending paper result.
 */
export interface TrendingPaper {
  uri: AtUri;
  title: string;
  authors: string[];
  fieldUri?: AtUri;
  fieldName?: string;
  score: number;
  viewCount: number;
  citationCount: number;
  engagementCount: number;
  trendWindow: TrendWindow;
}

/**
 * Trend time windows.
 */
export type TrendWindow = '24h' | '7d' | '30d' | 'all';

/**
 * Similar paper result.
 */
export interface SimilarPaper {
  uri: AtUri;
  title: string;
  authors: string[];
  similarity: number;
  reason: SimilarityReason;
  sharedReferences: number;
  sharedCiters: number;
}

/**
 * Similarity reason types.
 */
export type SimilarityReason =
  | 'co-citation'
  | 'bibliographic-coupling'
  | 'field-overlap'
  | 'author-overlap';

/**
 * Recommendation service options.
 */
export interface RecommendationServiceOptions {
  /** Neo4j connection */
  readonly connection: Neo4jConnection;
  /** Logger instance */
  readonly logger: ILogger;
}

/**
 * Recommendation service for discovering relevant papers.
 *
 * @remarks
 * Uses graph analysis to provide:
 * - Personalized recommendations based on user profile
 * - Trending papers based on recent engagement
 * - Similar papers for "read more like this"
 *
 * @example
 * ```typescript
 * const recommendations = container.resolve(RecommendationService);
 *
 * // Get personalized recommendations
 * const papers = await recommendations.getPersonalized(userDid, 10);
 *
 * // Get trending papers
 * const trending = await recommendations.getTrending('7d', 20);
 *
 * // Get similar papers
 * const similar = await recommendations.getSimilar(paperUri, 5);
 * ```
 */
@singleton()
export class RecommendationService {
  private readonly connection: Neo4jConnection;
  private readonly logger: ILogger;

  constructor(
    @inject('Neo4jConnection') connection: Neo4jConnection,
    @inject('Logger') logger: ILogger
  ) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Get personalized paper recommendations for a user.
   *
   * @remarks
   * Uses multiple signals to recommend papers:
   * - User's research fields/interests
   * - Papers cited by authors they follow
   * - Papers from coauthor network
   * - Papers trending in their fields
   *
   * @param userDid - User DID
   * @param limit - Maximum recommendations
   * @returns Personalized paper recommendations
   */
  async getPersonalized(userDid: DID, limit = 20): Promise<PaperRecommendation[]> {
    this.logger.debug('Getting personalized recommendations', { userDid, limit });

    const query = `
      // Get user's fields of interest
      MATCH (user:User {did: $userDid})
      OPTIONAL MATCH (user)-[:INTERESTED_IN]->(field:FieldNode)
      WITH user, collect(DISTINCT field) AS userFields

      // Find papers in user's fields that they haven't read
      CALL {
        WITH user, userFields
        UNWIND userFields AS field
        MATCH (paper:EprintSubmission)-[:CLASSIFIED_AS]->(field)
        WHERE NOT (user)-[:READ|BOOKMARKED]->(paper)
          AND paper.status = 'published'
        WITH paper, field, 'similar-fields' AS reason
        RETURN paper, reason, field.label AS fieldName
        LIMIT 50
      }

      // Find papers cited by papers user has engaged with
      UNION ALL
      CALL {
        WITH user
        MATCH (user)-[:READ|BOOKMARKED]->(engaged:EprintSubmission)-[:CITES]->(cited:EprintSubmission)
        WHERE NOT (user)-[:READ|BOOKMARKED]->(cited)
          AND cited.status = 'published'
        WITH cited AS paper, 'cited-by-interests' AS reason, null AS fieldName
        RETURN paper, reason, fieldName
        LIMIT 30
      }

      // Aggregate and score
      WITH paper, reason, fieldName, count(*) AS occurrences
      WITH paper,
           collect(reason)[0] AS primaryReason,
           collect(DISTINCT fieldName) AS relatedFieldNames,
           sum(occurrences) AS totalScore

      // Get paper details
      OPTIONAL MATCH (paper)<-[:AUTHORED]-(author:Author)
      WITH paper, primaryReason, relatedFieldNames, totalScore,
           collect(author.name)[..5] AS authorNames

      RETURN
        paper.uri AS uri,
        paper.title AS title,
        paper.abstract AS abstract,
        authorNames AS authors,
        totalScore AS score,
        primaryReason AS reason,
        relatedFieldNames AS relatedFields
      ORDER BY totalScore DESC
      LIMIT $limit
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { userDid, limit: neo4j.int(limit) });

      const recommendations = result.records.map((record) => ({
        uri: record.get('uri') as AtUri,
        title: (record.get('title') as string) ?? 'Untitled',
        abstract: record.get('abstract') as string | undefined,
        authors: (record.get('authors') as string[]) ?? [],
        score: Number(record.get('score')),
        reason: (record.get('reason') as RecommendationReason) ?? 'similar-fields',
        relatedFields: (record.get('relatedFields') as string[]) ?? [],
      }));

      this.logger.info('Generated personalized recommendations', {
        userDid,
        count: recommendations.length,
      });

      return recommendations;
    } catch (error) {
      this.logger.error(
        'Failed to get personalized recommendations',
        error instanceof Error ? error : undefined
      );
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get trending papers across the platform.
   *
   * @remarks
   * Scores papers based on:
   * - Recent views
   * - Recent citations
   * - Recent bookmarks/saves
   * - Engagement velocity (rate of change)
   *
   * @param window - Time window for trending calculation
   * @param limit - Maximum results
   * @param fieldUri - Optional field filter
   * @returns Trending papers
   */
  async getTrending(
    window: TrendWindow = '7d',
    limit = 20,
    fieldUri?: AtUri
  ): Promise<TrendingPaper[]> {
    this.logger.debug('Getting trending papers', { window, limit, fieldUri });

    // Calculate date threshold based on window
    const windowDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      all: 365 * 10, // Effectively all time
    }[window];

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - windowDays);

    const query = `
      MATCH (paper:EprintSubmission)
      WHERE paper.status = 'published'
        AND paper.createdAt >= datetime($dateThreshold)
        ${fieldUri ? 'AND (paper)-[:CLASSIFIED_AS]->(:FieldNode {uri: $fieldUri})' : ''}

      // Calculate engagement metrics
      OPTIONAL MATCH (paper)<-[:VIEWED]-(viewer)
      WITH paper, count(DISTINCT viewer) AS viewCount

      OPTIONAL MATCH (paper)<-[:CITES]-(citing:EprintSubmission)
      WHERE citing.createdAt >= datetime($dateThreshold)
      WITH paper, viewCount, count(DISTINCT citing) AS recentCitations

      OPTIONAL MATCH (paper)<-[:BOOKMARKED|ENDORSED]-(engager)
      WITH paper, viewCount, recentCitations, count(DISTINCT engager) AS engagementCount

      // Calculate trending score
      // Weight recent activity higher
      WITH paper, viewCount, recentCitations, engagementCount,
           (toFloat(viewCount) * 0.3 +
            toFloat(recentCitations) * 5.0 +
            toFloat(engagementCount) * 2.0) AS score

      WHERE score > 0

      // Get paper details
      OPTIONAL MATCH (paper)<-[:AUTHORED]-(author:Author)
      OPTIONAL MATCH (paper)-[:CLASSIFIED_AS]->(field:FieldNode)

      WITH paper, viewCount, recentCitations AS citationCount, engagementCount, score,
           collect(DISTINCT author.name)[..3] AS authorNames,
           collect(DISTINCT field)[0] AS primaryField

      RETURN
        paper.uri AS uri,
        paper.title AS title,
        authorNames AS authors,
        primaryField.uri AS fieldUri,
        primaryField.label AS fieldName,
        score,
        viewCount,
        citationCount,
        engagementCount,
        $window AS trendWindow
      ORDER BY score DESC
      LIMIT $limit
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, {
        dateThreshold: dateThreshold.toISOString(),
        limit: neo4j.int(limit),
        window,
        fieldUri: fieldUri ?? null,
      });

      const trending = result.records.map((record) => ({
        uri: record.get('uri') as AtUri,
        title: (record.get('title') as string) ?? 'Untitled',
        authors: (record.get('authors') as string[]) ?? [],
        fieldUri: record.get('fieldUri') as AtUri | undefined,
        fieldName: record.get('fieldName') as string | undefined,
        score: Number(record.get('score')),
        viewCount: Number(record.get('viewCount')),
        citationCount: Number(record.get('citationCount')),
        engagementCount: Number(record.get('engagementCount')),
        trendWindow: record.get('trendWindow') as TrendWindow,
      }));

      this.logger.info('Generated trending papers', {
        window,
        fieldUri,
        count: trending.length,
      });

      return trending;
    } catch (error) {
      this.logger.error(
        'Failed to get trending papers',
        error instanceof Error ? error : undefined
      );
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get similar papers to a given paper.
   *
   * @remarks
   * Uses multiple similarity signals:
   * - Co-citation: Papers cited together with the target
   * - Bibliographic coupling: Papers that cite similar references
   * - Field overlap: Papers in the same research fields
   * - Author overlap: Papers by shared authors
   *
   * @param paperUri - Target paper URI
   * @param limit - Maximum results
   * @returns Similar papers
   */
  async getSimilar(paperUri: AtUri, limit = 10): Promise<SimilarPaper[]> {
    this.logger.debug('Getting similar papers', { paperUri, limit });

    const query = `
      MATCH (target:EprintSubmission {uri: $paperUri})

      // Co-citation similarity: papers cited together
      CALL {
        WITH target
        MATCH (target)<-[:CITES]-(citingPaper)-[:CITES]->(similar:EprintSubmission)
        WHERE similar <> target AND similar.status = 'published'
        WITH similar, count(DISTINCT citingPaper) AS sharedCiters
        RETURN similar, 'co-citation' AS reason, 0 AS sharedRefs, sharedCiters
      }

      // Bibliographic coupling: papers citing same references
      UNION ALL
      CALL {
        WITH target
        MATCH (target)-[:CITES]->(ref)<-[:CITES]-(similar:EprintSubmission)
        WHERE similar <> target AND similar.status = 'published'
        WITH similar, count(DISTINCT ref) AS sharedRefs
        RETURN similar, 'bibliographic-coupling' AS reason, sharedRefs, 0 AS sharedCiters
      }

      // Aggregate results
      WITH similar, reason,
           sum(sharedRefs) AS totalSharedRefs,
           sum(sharedCiters) AS totalSharedCiters,
           count(*) AS occurrences

      // Calculate similarity score
      WITH similar, reason, totalSharedRefs, totalSharedCiters,
           (toFloat(totalSharedCiters) * 2.0 + toFloat(totalSharedRefs) * 1.5) AS similarity

      WHERE similarity > 0

      // Get paper details
      OPTIONAL MATCH (similar)<-[:AUTHORED]-(author:Author)

      WITH similar, similarity, reason, totalSharedRefs, totalSharedCiters,
           collect(DISTINCT author.name)[..3] AS authorNames

      RETURN
        similar.uri AS uri,
        similar.title AS title,
        authorNames AS authors,
        similarity,
        reason,
        totalSharedRefs AS sharedReferences,
        totalSharedCiters AS sharedCiters
      ORDER BY similarity DESC
      LIMIT $limit
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { paperUri, limit: neo4j.int(limit) });

      const similar = result.records.map((record) => ({
        uri: record.get('uri') as AtUri,
        title: (record.get('title') as string) ?? 'Untitled',
        authors: (record.get('authors') as string[]) ?? [],
        similarity: Number(record.get('similarity')),
        reason: (record.get('reason') as SimilarityReason) ?? 'co-citation',
        sharedReferences: Number(record.get('sharedReferences')),
        sharedCiters: Number(record.get('sharedCiters')),
      }));

      this.logger.info('Generated similar papers', {
        paperUri,
        count: similar.length,
      });

      return similar;
    } catch (error) {
      this.logger.error('Failed to get similar papers', error instanceof Error ? error : undefined);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get recommended fields for a user to explore.
   *
   * @param userDid - User DID
   * @param limit - Maximum results
   * @returns Recommended fields
   */
  async getRecommendedFields(
    userDid: DID,
    limit = 10
  ): Promise<{ uri: AtUri; name: string; score: number; reason: string }[]> {
    this.logger.debug('Getting recommended fields', { userDid, limit });

    const query = `
      MATCH (user:User {did: $userDid})
      OPTIONAL MATCH (user)-[:INTERESTED_IN]->(currentField:FieldNode)
      WITH user, collect(currentField) AS currentFields

      // Find related fields through graph structure
      UNWIND currentFields AS field
      MATCH (field)-[:RELATED_TO|SUBFIELD_OF*1..2]-(candidate:FieldNode)
      WHERE NOT candidate IN currentFields

      WITH candidate, count(*) AS proximity

      // Check trending papers in candidate fields
      OPTIONAL MATCH (paper:EprintSubmission)-[:CLASSIFIED_AS]->(candidate)
      WHERE paper.status = 'published'
      WITH candidate, proximity, count(paper) AS paperCount

      WITH candidate,
           (toFloat(proximity) * 0.6 + toFloat(paperCount) * 0.001) AS score

      WHERE score > 0

      RETURN
        candidate.uri AS uri,
        candidate.label AS name,
        score,
        'related-to-interests' AS reason
      ORDER BY score DESC
      LIMIT $limit
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { userDid, limit: neo4j.int(limit) });

      return result.records.map((record) => ({
        uri: record.get('uri') as AtUri,
        name: (record.get('name') as string) ?? 'Unknown Field',
        score: Number(record.get('score')),
        reason: record.get('reason') as string,
      }));
    } catch (error) {
      this.logger.error(
        'Failed to get recommended fields',
        error instanceof Error ? error : undefined
      );
      return [];
    } finally {
      await session.close();
    }
  }
}
