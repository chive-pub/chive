/**
 * Judgment list exporter for LTR model training.
 *
 * @remarks
 * Exports relevance logging data in SVM Rank format for training
 * LTR models with XGBoost, RankLib, or Elasticsearch LTR plugin.
 *
 * **SVM Rank Format:**
 * ```
 * grade qid:query_id 1:feature1 2:feature2 ... # doc_id comment
 * ```
 *
 * **Relevance Grades:**
 * - 4: Clicked + downloaded (strong positive)
 * - 3: Clicked + dwell > 30s (positive)
 * - 2: Clicked + dwell 10-30s (weak positive)
 * - 1: Clicked + dwell < 10s (uncertain)
 * - 0: Shown but not clicked (negative)
 *
 * @see https://elasticsearch-learning-to-rank.readthedocs.io/en/latest/
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { ILogger } from '../../types/interfaces/logger.interface.js';

import type { LTRFeatureVector } from './relevance-logger.js';

/**
 * Export options for judgment list generation.
 *
 * @public
 */
export interface ExportOptions {
  /**
   * Start date for data range.
   */
  readonly startDate: Date;

  /**
   * End date for data range.
   */
  readonly endDate: Date;

  /**
   * Minimum impressions per query to include.
   *
   * @defaultValue 5
   */
  readonly minImpressions?: number;

  /**
   * Output format.
   *
   * @defaultValue 'svmrank'
   */
  readonly format?: 'svmrank' | 'csv';

  /**
   * Whether to include position bias correction.
   *
   * @defaultValue true
   */
  readonly positionBiasCorrection?: boolean;

  /**
   * Maximum queries to export (for testing).
   */
  readonly maxQueries?: number;
}

/**
 * Export statistics.
 *
 * @public
 */
export interface ExportStats {
  readonly queriesExported: number;
  readonly documentsExported: number;
  readonly clicksIncluded: number;
  readonly dateRange: { start: string; end: string };
}

/**
 * Judgment list row from database view.
 */
interface JudgmentRow {
  query_id: string;
  query: string;
  uri: string;
  position: number;
  features: LTRFeatureVector;
  impression_at: Date;
  clicked_at: Date | null;
  dwell_time_ms: number | null;
  downloaded: boolean;
  relevance_grade: number;
}

/**
 * Judgment list exporter interface.
 *
 * @public
 */
export interface IJudgmentListExporter {
  /**
   * Exports judgment list in specified format.
   *
   * @param options - Export options
   * @returns Async generator of output lines
   */
  export(options: ExportOptions): AsyncIterable<string>;

  /**
   * Gets export statistics without generating data.
   *
   * @param options - Export options
   * @returns Statistics about the data to be exported
   */
  getStats(options: ExportOptions): Promise<ExportStats>;
}

/**
 * Configuration for JudgmentListExporter.
 *
 * @public
 */
export interface JudgmentListExporterConfig {
  /**
   * PostgreSQL connection pool.
   */
  readonly pool: Pool;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Feature names in order for SVM Rank format.
   *
   * @defaultValue ['textRelevance', 'fieldMatchScore', 'titleMatchScore', 'abstractMatchScore', 'recencyScore', 'bm25Score', 'originalPosition']
   */
  readonly featureOrder?: readonly string[];
}

/**
 * Default feature order for SVM Rank export.
 */
const DEFAULT_FEATURE_ORDER: readonly string[] = [
  'textRelevance',
  'fieldMatchScore',
  'titleMatchScore',
  'abstractMatchScore',
  'recencyScore',
  'bm25Score',
  'originalPosition',
];

/**
 * Position bias correction factors (COEC model approximation).
 *
 * @remarks
 * Users tend to click items higher in the list regardless of relevance.
 * These factors adjust the relevance signal based on position.
 *
 * Values based on empirical studies of click-through rates by position.
 */
const POSITION_BIAS_FACTORS: readonly number[] = [
  1.0, // Position 0 (baseline)
  0.85, // Position 1
  0.72, // Position 2
  0.61, // Position 3
  0.52, // Position 4
  0.44, // Position 5
  0.37, // Position 6
  0.31, // Position 7
  0.26, // Position 8
  0.22, // Position 9
  0.19, // Position 10+
];

/**
 * Judgment list exporter implementation.
 *
 * @public
 */
export class JudgmentListExporter implements IJudgmentListExporter {
  private readonly pool: Pool;
  private readonly logger: ILogger;
  private readonly featureOrder: readonly string[];

  constructor(config: JudgmentListExporterConfig) {
    this.pool = config.pool;
    this.logger = config.logger;
    this.featureOrder = config.featureOrder ?? DEFAULT_FEATURE_ORDER;
  }

  /**
   * Exports judgment list in specified format.
   */
  async *export(options: ExportOptions): AsyncIterable<string> {
    const format = options.format ?? 'svmrank';
    const minImpressions = options.minImpressions ?? 5;
    const positionBiasCorrection = options.positionBiasCorrection ?? true;

    this.logger.info('Starting judgment list export', {
      startDate: options.startDate.toISOString(),
      endDate: options.endDate.toISOString(),
      format,
      minImpressions,
      positionBiasCorrection,
    });

    // Get queries with sufficient impressions
    const queriesResult = await this.pool.query<{ query_id: string; impression_count: number }>(
      `SELECT query_id, COUNT(DISTINCT si.id) as impression_count
       FROM search_impressions si
       WHERE si.created_at >= $1 AND si.created_at <= $2
       GROUP BY query_id
       HAVING COUNT(DISTINCT si.id) >= $3
       ORDER BY query_id
       ${options.maxQueries ? `LIMIT ${options.maxQueries}` : ''}`,
      [options.startDate, options.endDate, minImpressions]
    );

    this.logger.info('Found queries for export', {
      queryCount: queriesResult.rows.length,
    });

    // Output header for CSV format
    if (format === 'csv') {
      yield `relevance_grade,query_id,uri,position,${this.featureOrder.join(',')},clicked,dwell_time_ms,downloaded\n`;
    }

    // Process each query
    let queryIndex = 0;
    for (const { query_id } of queriesResult.rows) {
      queryIndex++;

      // Fetch judgment data for this query
      const judgmentResult = await this.pool.query<JudgmentRow>(
        `SELECT * FROM v_judgment_list
         WHERE query_id = $1
           AND impression_at >= $2
           AND impression_at <= $3
         ORDER BY impression_at, position`,
        [query_id, options.startDate, options.endDate]
      );

      for (const row of judgmentResult.rows) {
        // Apply position bias correction if enabled
        const grade = row.relevance_grade;
        if (positionBiasCorrection && grade === 0) {
          // Adjust negative signal based on position visibility
          const biasFactor =
            POSITION_BIAS_FACTORS[Math.min(row.position, POSITION_BIAS_FACTORS.length - 1)];
          // Don't penalize items that weren't visible (implicit negative is weaker)
          if (biasFactor && biasFactor < 0.5) {
            // Skip very low visibility items from negative examples
            continue;
          }
        }

        if (format === 'svmrank') {
          yield this.formatSvmRankLine(grade, queryIndex, row);
        } else {
          yield this.formatCsvLine(grade, query_id, row);
        }
      }
    }

    this.logger.info('Completed judgment list export', {
      queriesExported: queriesResult.rows.length,
    });
  }

  /**
   * Gets export statistics without generating data.
   */
  async getStats(options: ExportOptions): Promise<ExportStats> {
    const minImpressions = options.minImpressions ?? 5;

    // Count queries
    const queriesResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT query_id)::text as count
       FROM (
         SELECT query_id
         FROM search_impressions si
         WHERE si.created_at >= $1 AND si.created_at <= $2
         GROUP BY query_id
         HAVING COUNT(DISTINCT si.id) >= $3
       ) sq`,
      [options.startDate, options.endDate, minImpressions]
    );

    // Count documents
    const docsResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM v_judgment_list
       WHERE impression_at >= $1 AND impression_at <= $2`,
      [options.startDate, options.endDate]
    );

    // Count clicks
    const clicksResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM result_clicks rc
       JOIN search_impressions si ON rc.impression_id = si.id
       WHERE si.created_at >= $1 AND si.created_at <= $2`,
      [options.startDate, options.endDate]
    );

    return {
      queriesExported: parseInt(queriesResult.rows[0]?.count ?? '0', 10),
      documentsExported: parseInt(docsResult.rows[0]?.count ?? '0', 10),
      clicksIncluded: parseInt(clicksResult.rows[0]?.count ?? '0', 10),
      dateRange: {
        start: options.startDate.toISOString(),
        end: options.endDate.toISOString(),
      },
    };
  }

  /**
   * Formats a single line in SVM Rank format.
   */
  private formatSvmRankLine(grade: number, queryIndex: number, row: JudgmentRow): string {
    const features = this.extractFeatures(row.features);
    const featureStr = features.map((v, i) => `${i + 1}:${v}`).join(' ');
    return `${grade} qid:${queryIndex} ${featureStr} # ${row.uri}\n`;
  }

  /**
   * Formats a single line in CSV format.
   */
  private formatCsvLine(grade: number, queryId: string, row: JudgmentRow): string {
    const features = this.extractFeatures(row.features);
    const clicked = row.clicked_at !== null ? '1' : '0';
    const dwellTime = row.dwell_time_ms?.toString() ?? '';
    const downloaded = row.downloaded ? '1' : '0';
    return `${grade},${queryId},${row.uri},${row.position},${features.join(',')},${clicked},${dwellTime},${downloaded}\n`;
  }

  /**
   * Extracts features in order from feature vector.
   */
  private extractFeatures(features: LTRFeatureVector): number[] {
    return this.featureOrder.map((name) => {
      const value = (features as unknown as Record<string, unknown>)[name];
      return typeof value === 'number' ? value : 0;
    });
  }
}

export default JudgmentListExporter;
