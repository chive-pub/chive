/**
 * Unit tests for FieldPromotionJob.
 *
 * @remarks
 * Tests startup behavior (runOnStartup flag), delegation to
 * AutomaticProposalService, concurrent execution protection,
 * and interval cleanup on stop.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { FieldPromotionJob } from '@/jobs/field-promotion-job.js';
import type { AutomaticProposalService } from '@/services/governance/automatic-proposal-service.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// Mock: observability tracer
// =============================================================================

vi.mock('@/observability/tracer.js', () => ({
  withSpan: (_name: string, fn: () => unknown) => fn(),
  addSpanAttributes: vi.fn(),
}));

// =============================================================================
// Helpers
// =============================================================================

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

function createMockProposalService(): AutomaticProposalService {
  return {
    checkAndCreateFieldProposals: vi.fn().mockResolvedValue({
      proposalsCreated: 0,
      candidatesEvaluated: 0,
      candidatesSkipped: 0,
    }),
  } as unknown as AutomaticProposalService;
}

// =============================================================================
// Tests
// =============================================================================

describe('FieldPromotionJob', () => {
  let job: FieldPromotionJob;
  let mockLogger: ILogger;
  let mockProposalService: AutomaticProposalService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLogger = createMockLogger();
    mockProposalService = createMockProposalService();
  });

  afterEach(() => {
    // Clean up any intervals
    job?.stop();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // start: runOnStartup = true (default)
  // ---------------------------------------------------------------------------

  describe('start', () => {
    it('runs initial check when runOnStartup is true', async () => {
      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        intervalMs: 60_000,
        runOnStartup: true,
      });

      await job.start();

      expect(mockProposalService.checkAndCreateFieldProposals).toHaveBeenCalledTimes(1);
    });

    it('runs initial check by default (runOnStartup unset)', async () => {
      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        intervalMs: 60_000,
      });

      await job.start();

      expect(mockProposalService.checkAndCreateFieldProposals).toHaveBeenCalledTimes(1);
    });

    it('skips initial check when runOnStartup is false', async () => {
      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        intervalMs: 60_000,
        runOnStartup: false,
      });

      await job.start();

      expect(mockProposalService.checkAndCreateFieldProposals).not.toHaveBeenCalled();
    });

    it('logs and continues when initial check fails', async () => {
      vi.mocked(mockProposalService.checkAndCreateFieldProposals).mockRejectedValueOnce(
        new Error('Initial check boom')
      );

      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        intervalMs: 60_000,
        runOnStartup: true,
      });

      // Should not throw despite the initial check failing
      await expect(job.start()).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Initial field promotion check failed',
        expect.any(Error)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // run: delegation to automaticProposalService
  // ---------------------------------------------------------------------------

  describe('run', () => {
    it('delegates to automaticProposalService.checkAndCreateFieldProposals', async () => {
      vi.mocked(mockProposalService.checkAndCreateFieldProposals).mockResolvedValue({
        proposalsCreated: 3,
        candidatesEvaluated: 10,
        candidatesSkipped: 2,
      });

      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        intervalMs: 60_000,
        runOnStartup: false,
      });

      const result = await job.run();

      expect(result).toEqual({
        proposalsCreated: 3,
        candidatesEvaluated: 10,
        candidatesSkipped: 2,
      });
      expect(mockProposalService.checkAndCreateFieldProposals).toHaveBeenCalledTimes(1);
    });

    it('skips if already running (concurrent protection)', async () => {
      // Make the first run hang until we resolve it
      let resolveFirst!: () => void;
      const firstRunPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      vi.mocked(mockProposalService.checkAndCreateFieldProposals).mockImplementationOnce(
        async () => {
          await firstRunPromise;
          return { proposalsCreated: 1, candidatesEvaluated: 5, candidatesSkipped: 0 };
        }
      );

      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        intervalMs: 60_000,
        runOnStartup: false,
      });

      // Start first run (will block)
      const firstRun = job.run();
      expect(job.getIsRunning()).toBe(true);

      // Second run should return immediately with zeros
      const secondResult = await job.run();
      expect(secondResult).toEqual({
        proposalsCreated: 0,
        candidatesEvaluated: 0,
        candidatesSkipped: 0,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Field promotion check already running, skipping'
      );

      // Let the first run complete
      resolveFirst();
      const firstResult = await firstRun;
      expect(firstResult.proposalsCreated).toBe(1);
    });

    it('resets isRunning flag after failure', async () => {
      vi.mocked(mockProposalService.checkAndCreateFieldProposals).mockRejectedValueOnce(
        new Error('check failed')
      );

      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        intervalMs: 60_000,
        runOnStartup: false,
      });

      await expect(job.run()).rejects.toThrow('check failed');
      expect(job.getIsRunning()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // stop: clears interval
  // ---------------------------------------------------------------------------

  describe('stop', () => {
    it('clears interval', async () => {
      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        intervalMs: 60_000,
        runOnStartup: false,
      });

      await job.start();

      // Advance time to trigger one interval tick
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockProposalService.checkAndCreateFieldProposals).toHaveBeenCalledTimes(1);

      job.stop();

      // Advance time again; no additional calls should happen
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockProposalService.checkAndCreateFieldProposals).toHaveBeenCalledTimes(1);

      expect(mockLogger.info).toHaveBeenCalledWith('Field promotion job stopped');
    });

    it('is safe to call stop multiple times', () => {
      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        intervalMs: 60_000,
        runOnStartup: false,
      });

      // Stop without start should not throw
      expect(() => job.stop()).not.toThrow();
      expect(() => job.stop()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Periodic execution via setInterval
  // ---------------------------------------------------------------------------

  describe('periodic execution', () => {
    it('runs on each interval tick', async () => {
      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        intervalMs: 10_000,
        runOnStartup: false,
      });

      await job.start();

      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockProposalService.checkAndCreateFieldProposals).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockProposalService.checkAndCreateFieldProposals).toHaveBeenCalledTimes(2);
    });

    it('uses 24-hour default interval when intervalMs is not set', async () => {
      job = new FieldPromotionJob({
        automaticProposalService: mockProposalService,
        logger: mockLogger,
        runOnStartup: false,
      });

      await job.start();

      // Advance less than 24 hours: no calls
      await vi.advanceTimersByTimeAsync(86_399_000);
      expect(mockProposalService.checkAndCreateFieldProposals).not.toHaveBeenCalled();

      // Advance past the 24-hour mark
      await vi.advanceTimersByTimeAsync(1_001);
      expect(mockProposalService.checkAndCreateFieldProposals).toHaveBeenCalledTimes(1);
    });
  });
});
