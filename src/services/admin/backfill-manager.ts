/**
 * Backfill operation manager for admin dashboard.
 *
 * @remarks
 * Tracks running backfill operations in Redis, supports cancellation
 * via AbortController, and provides status reporting for the admin UI.
 *
 * @packageDocumentation
 * @public
 */

import { randomUUID } from 'node:crypto';

import type { Redis } from 'ioredis';

import { backfillMetrics } from '../../observability/prometheus-registry.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Types of backfill operations.
 */
export type BackfillOperationType =
  | 'pdsScan'
  | 'freshnessScan'
  | 'citationExtraction'
  | 'fullReindex'
  | 'governanceSync'
  | 'didSync';

/**
 * Status of a backfill operation.
 */
export type BackfillStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Backfill operation record stored in Redis.
 */
export interface BackfillOperation {
  readonly id: string;
  readonly type: BackfillOperationType;
  readonly status: BackfillStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly progress?: number;
  readonly recordsProcessed?: number;
  readonly error?: string;
  readonly metadata?: Record<string, unknown>;
}

const REDIS_PREFIX = 'chive:admin:backfill:';
const OPERATIONS_SET_KEY = 'chive:admin:backfill:operations';
const OPERATION_TTL_SECONDS = 86400; // 24 hours

/**
 * Manages backfill operations with Redis-backed state tracking.
 *
 * @public
 */
export class BackfillManager {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly abortControllers = new Map<string, AbortController>();
  private readonly durationTimers = new Map<string, () => number>();

  constructor(redis: Redis, logger: ILogger) {
    this.redis = redis;
    this.logger = logger.child({ service: 'BackfillManager' });
  }

  /**
   * Starts a new backfill operation.
   *
   * @param type - type of backfill operation
   * @param metadata - additional metadata to store
   * @returns the operation record and an AbortSignal for cancellation
   */
  async startOperation(
    type: BackfillOperationType,
    metadata?: Record<string, unknown>
  ): Promise<{ operation: BackfillOperation; signal: AbortSignal }> {
    const id = randomUUID();
    const abortController = new AbortController();

    const operation: BackfillOperation = {
      id,
      type,
      status: 'running',
      startedAt: new Date().toISOString(),
      progress: 0,
      recordsProcessed: 0,
      metadata,
    };

    // Store in Redis
    const key = `${REDIS_PREFIX}${id}`;
    await this.redis.setex(key, OPERATION_TTL_SECONDS, JSON.stringify(operation));
    await this.redis.sadd(OPERATIONS_SET_KEY, id);

    // Track abort controller
    this.abortControllers.set(id, abortController);

    // Track metrics
    backfillMetrics.operationsTotal.inc({ type, status: 'started' });
    this.durationTimers.set(id, backfillMetrics.duration.startTimer({ type }));

    this.logger.info('Backfill operation started', { id, type });

    return { operation, signal: abortController.signal };
  }

  /**
   * Updates progress of a running operation.
   *
   * @param id - operation ID
   * @param progress - progress percentage (0-100)
   * @param recordsProcessed - number of records processed so far
   */
  async updateProgress(id: string, progress: number, recordsProcessed: number): Promise<void> {
    const operation = await this.getStatus(id);
    if (operation?.status !== 'running') return;

    const updated: BackfillOperation = {
      ...operation,
      progress,
      recordsProcessed,
    };

    const key = `${REDIS_PREFIX}${id}`;
    await this.redis.setex(key, OPERATION_TTL_SECONDS, JSON.stringify(updated));
  }

  /**
   * Marks an operation as completed.
   *
   * @param id - operation ID
   * @param recordsProcessed - final record count
   */
  async completeOperation(id: string, recordsProcessed?: number): Promise<void> {
    const operation = await this.getStatus(id);
    if (!operation) return;

    const updated: BackfillOperation = {
      ...operation,
      status: 'completed',
      completedAt: new Date().toISOString(),
      progress: 100,
      recordsProcessed: recordsProcessed ?? operation.recordsProcessed,
    };

    const key = `${REDIS_PREFIX}${id}`;
    await this.redis.setex(key, OPERATION_TTL_SECONDS, JSON.stringify(updated));

    this.abortControllers.delete(id);

    backfillMetrics.operationsTotal.inc({ type: operation.type, status: 'completed' });
    const finalRecords = recordsProcessed ?? operation.recordsProcessed;
    if (finalRecords) {
      backfillMetrics.recordsProcessed.inc({ type: operation.type }, finalRecords);
    }
    const endTimer = this.durationTimers.get(id);
    if (endTimer) {
      endTimer();
      this.durationTimers.delete(id);
    }

    this.logger.info('Backfill operation completed', { id, recordsProcessed });
  }

  /**
   * Marks an operation as failed.
   *
   * @param id - operation ID
   * @param error - error message
   */
  async failOperation(id: string, error: string): Promise<void> {
    const operation = await this.getStatus(id);
    if (!operation) return;

    const updated: BackfillOperation = {
      ...operation,
      status: 'failed',
      completedAt: new Date().toISOString(),
      error,
    };

    const key = `${REDIS_PREFIX}${id}`;
    await this.redis.setex(key, OPERATION_TTL_SECONDS, JSON.stringify(updated));

    this.abortControllers.delete(id);

    backfillMetrics.operationsTotal.inc({ type: operation.type, status: 'failed' });
    const endTimer = this.durationTimers.get(id);
    if (endTimer) {
      endTimer();
      this.durationTimers.delete(id);
    }

    this.logger.error('Backfill operation failed', undefined, { id, error });
  }

  /**
   * Cancels a running operation by signaling its AbortController.
   *
   * @param id - operation ID
   * @returns true if the operation was cancelled, false if not found or not running
   */
  async cancelOperation(id: string): Promise<boolean> {
    const operation = await this.getStatus(id);
    if (operation?.status !== 'running') return false;

    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }

    const updated: BackfillOperation = {
      ...operation,
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    };

    const key = `${REDIS_PREFIX}${id}`;
    await this.redis.setex(key, OPERATION_TTL_SECONDS, JSON.stringify(updated));

    backfillMetrics.operationsTotal.inc({ type: operation.type, status: 'cancelled' });
    const endTimer = this.durationTimers.get(id);
    if (endTimer) {
      endTimer();
      this.durationTimers.delete(id);
    }

    this.logger.info('Backfill operation cancelled', { id });
    return true;
  }

  /**
   * Gets the status of a specific operation.
   *
   * @param id - operation ID
   * @returns the operation record, or null if not found
   */
  async getStatus(id: string): Promise<BackfillOperation | null> {
    const key = `${REDIS_PREFIX}${id}`;
    const data = await this.redis.get(key);
    if (!data) return null;

    return JSON.parse(data) as BackfillOperation;
  }

  /**
   * Lists all known operations, optionally filtered by status.
   *
   * @param status - optional status filter
   * @returns list of operation records
   */
  async listOperations(status?: BackfillStatus): Promise<readonly BackfillOperation[]> {
    const operationIds = await this.redis.smembers(OPERATIONS_SET_KEY);
    const operations: BackfillOperation[] = [];

    for (const id of operationIds) {
      const operation = await this.getStatus(id);
      if (operation) {
        if (!status || operation.status === status) {
          operations.push(operation);
        }
      } else {
        // Clean up stale set entry
        await this.redis.srem(OPERATIONS_SET_KEY, id);
      }
    }

    // Sort by startedAt descending
    operations.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

    return operations;
  }
}
