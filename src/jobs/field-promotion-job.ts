/**
 * Scheduled job for promoting tags to field proposals.
 *
 * @remarks
 * Runs on a configurable interval (daily by default) to check whether any
 * user-generated tags have met the field promotion criteria:
 * - usageCount >= 10
 * - uniqueUsers >= 5
 * - qualityScore >= 0.7
 * - spamScore < 0.3
 *
 * Tags meeting these criteria are promoted to `pub.chive.graph.fieldProposal`
 * records in the Governance PDS, where they enter the community voting workflow.
 *
 * **ATProto Compliance:**
 * - READ-ONLY scans of local Neo4j tag indexes
 * - Writes only to Governance PDS (not user PDSes)
 * - All data rebuildable from firehose events
 *
 * @packageDocumentation
 * @public
 */

import { withSpan, addSpanAttributes } from '../observability/tracer.js';
import type {
  AutomaticProposalService,
  FieldPromotionResult,
} from '../services/governance/automatic-proposal-service.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Field promotion job configuration.
 *
 * @public
 */
export interface FieldPromotionJobConfig {
  /**
   * Automatic proposal service for creating field proposals.
   */
  readonly automaticProposalService: AutomaticProposalService;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Interval between promotion checks in milliseconds.
   *
   * @defaultValue 86400000 (24 hours)
   */
  readonly intervalMs?: number;

  /**
   * Whether to run an initial check on startup.
   *
   * @defaultValue true
   */
  readonly runOnStartup?: boolean;
}

/**
 * Scheduled job that promotes high-quality tags to field proposals.
 *
 * @example
 * ```typescript
 * const job = new FieldPromotionJob({
 *   automaticProposalService,
 *   logger,
 *   intervalMs: 24 * 60 * 60 * 1000, // daily
 * });
 *
 * await job.start();
 * // Later...
 * job.stop();
 * ```
 *
 * @public
 */
export class FieldPromotionJob {
  private readonly automaticProposalService: AutomaticProposalService;
  private readonly logger: ILogger;
  private readonly intervalMs: number;
  private readonly runOnStartup: boolean;

  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /**
   * Creates a new FieldPromotionJob.
   *
   * @param config - Job configuration
   */
  constructor(config: FieldPromotionJobConfig) {
    this.automaticProposalService = config.automaticProposalService;
    this.logger = config.logger;
    this.intervalMs = config.intervalMs ?? 86_400_000; // 24 hours
    this.runOnStartup = config.runOnStartup ?? true;
  }

  /**
   * Starts the field promotion job.
   *
   * @remarks
   * If runOnStartup is true, performs an immediate check before starting
   * the periodic schedule. Startup failures are logged but do not
   * prevent the periodic schedule from starting.
   */
  async start(): Promise<void> {
    this.logger.info('Starting field promotion job', {
      intervalMs: this.intervalMs,
      runOnStartup: this.runOnStartup,
    });

    if (this.runOnStartup) {
      try {
        await this.run();
      } catch (error) {
        this.logger.error(
          'Initial field promotion check failed',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    this.intervalHandle = setInterval(() => {
      void this.run().catch((error) => {
        this.logger.error(
          'Periodic field promotion check failed',
          error instanceof Error ? error : new Error(String(error))
        );
      });
    }, this.intervalMs);
  }

  /**
   * Stops the field promotion job.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.info('Field promotion job stopped');
  }

  /**
   * Runs a single field promotion check.
   *
   * @returns Promotion result with counts of proposals created and candidates evaluated
   */
  async run(): Promise<FieldPromotionResult> {
    if (this.isRunning) {
      this.logger.debug('Field promotion check already running, skipping');
      return { proposalsCreated: 0, candidatesEvaluated: 0, candidatesSkipped: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const result = await withSpan('FieldPromotionJob.run', async () => {
        return this.automaticProposalService.checkAndCreateFieldProposals();
      });

      const durationMs = Date.now() - startTime;

      addSpanAttributes({
        'field_promotion_job.duration_ms': durationMs,
        'field_promotion_job.proposals_created': result.proposalsCreated,
        'field_promotion_job.candidates_evaluated': result.candidatesEvaluated,
      });

      this.logger.info('Field promotion job completed', {
        proposalsCreated: result.proposalsCreated,
        candidatesEvaluated: result.candidatesEvaluated,
        candidatesSkipped: result.candidatesSkipped,
        durationMs,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.logger.error('Field promotion job failed', error instanceof Error ? error : undefined, {
        durationMs,
      });

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Checks if the job is currently running.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}
