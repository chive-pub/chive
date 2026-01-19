/**
 * PDS Scan Scheduler job.
 *
 * @remarks
 * Scheduled job that queues PDS scans for PDSes that are ready to be scanned.
 * Runs periodically to ensure PDSes are scanned on schedule.
 *
 * **Priority:**
 * - PDSes with Chive records get higher priority (scanned more frequently)
 * - New/pending PDSes get moderate priority
 * - PDSes without Chive records get low priority
 *
 * **ATProto Compliance:**
 * - READ-ONLY from PDSes via standard XRPC
 * - Does not write to user PDSes
 * - All data rebuildable from source
 *
 * @packageDocumentation
 * @public
 */

import type { IPDSRegistry } from '../services/pds-discovery/pds-registry.js';
import { PDSScanner } from '../services/pds-discovery/pds-scanner.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * PDS Scan Scheduler job configuration.
 *
 * @public
 */
export interface PDSScanSchedulerJobConfig {
  /**
   * PDS Registry service.
   */
  readonly registry: IPDSRegistry;

  /**
   * PDS Scanner service.
   */
  readonly scanner: PDSScanner;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Scan interval in milliseconds.
   *
   * @defaultValue 900000 (15 minutes)
   */
  readonly scanIntervalMs?: number;

  /**
   * Maximum PDSes to scan per run.
   *
   * @defaultValue 5
   */
  readonly batchSize?: number;

  /**
   * Number of concurrent scans.
   *
   * @defaultValue 2
   */
  readonly concurrency?: number;
}

/**
 * Scan run result.
 *
 * @public
 */
export interface PDSScanRunResult {
  /**
   * Whether scan completed successfully.
   */
  readonly success: boolean;

  /**
   * Number of PDSes scanned.
   */
  readonly pdsesScanned: number;

  /**
   * Number of records found.
   */
  readonly recordsFound: number;

  /**
   * Number of PDSes with Chive records.
   */
  readonly pdsesWithRecords: number;

  /**
   * Number of scan failures.
   */
  readonly failures: number;

  /**
   * Duration in milliseconds.
   */
  readonly durationMs: number;

  /**
   * Error message (if failed).
   */
  readonly error?: string;
}

/**
 * PDS Scan Scheduler job.
 *
 * @remarks
 * Periodically checks for PDSes ready to be scanned and runs scans.
 *
 * @example
 * ```typescript
 * const scanJob = new PDSScanSchedulerJob({
 *   registry,
 *   scanner,
 *   logger,
 *   scanIntervalMs: 900000, // 15 minutes
 *   batchSize: 5,
 * });
 *
 * await scanJob.start();
 *
 * // Later...
 * scanJob.stop();
 * ```
 *
 * @public
 */
export class PDSScanSchedulerJob {
  private readonly registry: IPDSRegistry;
  private readonly scanner: PDSScanner;
  private readonly logger: ILogger;
  private readonly scanIntervalMs: number;
  private readonly batchSize: number;
  private readonly concurrency: number;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastRunResult: PDSScanRunResult | null = null;

  constructor(config: PDSScanSchedulerJobConfig) {
    this.registry = config.registry;
    this.scanner = config.scanner;
    this.logger = config.logger.child({ service: 'pds-scan-scheduler-job' });
    this.scanIntervalMs = config.scanIntervalMs ?? 900_000; // 15 minutes
    this.batchSize = config.batchSize ?? 5;
    this.concurrency = config.concurrency ?? 2;
  }

  /**
   * Starts the scan scheduler with periodic execution.
   */
  async start(): Promise<void> {
    this.logger.info('Starting PDS scan scheduler job', {
      scanIntervalMs: this.scanIntervalMs,
      batchSize: this.batchSize,
      concurrency: this.concurrency,
    });

    // Run immediately on start
    await this.run();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.run().catch((err) => {
        this.logger.error('PDS scan scheduler job failed', err instanceof Error ? err : undefined);
      });
    }, this.scanIntervalMs);
  }

  /**
   * Stops the scan scheduler.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.info('PDS scan scheduler job stopped');
  }

  /**
   * Runs a single scan cycle.
   *
   * @returns Scan run result
   */
  async run(): Promise<PDSScanRunResult> {
    if (this.isRunning) {
      this.logger.debug('Scan already in progress, skipping');
      return {
        success: false,
        pdsesScanned: 0,
        recordsFound: 0,
        pdsesWithRecords: 0,
        failures: 0,
        durationMs: 0,
        error: 'Scan already in progress',
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.debug('Starting PDS scan cycle');

      // Get PDSes that are ready for scanning
      const pendingScan = await this.registry.getPDSesForScan(this.batchSize);

      if (pendingScan.length === 0) {
        this.logger.debug('No PDSes ready for scanning');
        const result: PDSScanRunResult = {
          success: true,
          pdsesScanned: 0,
          recordsFound: 0,
          pdsesWithRecords: 0,
          failures: 0,
          durationMs: Date.now() - startTime,
        };
        this.lastRunResult = result;
        return result;
      }

      // Sort by priority - PDSes with Chive records first
      const sortedPDSes = [...pendingScan].sort((a, b) => {
        // Has records > pending > no records
        if (a.hasChiveRecords && !b.hasChiveRecords) return -1;
        if (!a.hasChiveRecords && b.hasChiveRecords) return 1;
        return a.scanPriority - b.scanPriority;
      });

      // Scan PDSes
      const results = await this.scanner.scanMultiplePDSes(
        sortedPDSes.map((p) => p.pdsUrl),
        this.concurrency
      );

      // Count results
      let recordsFound = 0;
      let pdsesWithRecords = 0;
      let failures = 0;

      for (const [pdsUrl, result] of results) {
        if (result instanceof Error) {
          failures++;
          this.logger.debug('PDS scan failed', { pdsUrl, error: result.message });
        } else {
          recordsFound += result.chiveRecordCount;
          if (result.hasChiveRecords) {
            pdsesWithRecords++;
          }
        }
      }

      const durationMs = Date.now() - startTime;

      const result: PDSScanRunResult = {
        success: true,
        pdsesScanned: results.size,
        recordsFound,
        pdsesWithRecords,
        failures,
        durationMs,
      };

      this.lastRunResult = result;

      this.logger.info('PDS scan cycle completed', {
        pdsesScanned: result.pdsesScanned,
        recordsFound: result.recordsFound,
        pdsesWithRecords: result.pdsesWithRecords,
        failures: result.failures,
        durationMs: result.durationMs,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('PDS scan cycle failed', error instanceof Error ? error : undefined);

      const result: PDSScanRunResult = {
        success: false,
        pdsesScanned: 0,
        recordsFound: 0,
        pdsesWithRecords: 0,
        failures: 0,
        durationMs,
        error: errorMessage,
      };

      this.lastRunResult = result;
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Gets the last run result.
   *
   * @returns Last scan run result or null if never run
   */
  getLastRunResult(): PDSScanRunResult | null {
    return this.lastRunResult;
  }

  /**
   * Checks if the job is currently running.
   */
  isJobRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Triggers an immediate scan (if not already running).
   *
   * @returns Scan run result
   */
  async triggerScan(): Promise<PDSScanRunResult> {
    return this.run();
  }
}
