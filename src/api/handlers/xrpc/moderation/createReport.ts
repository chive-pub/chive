/**
 * XRPC handler for pub.chive.moderation.createReport.
 *
 * @remarks
 * Allows authenticated users to report content for moderation review.
 * Duplicate reports from the same user for the same content are idempotent.
 *
 * @packageDocumentation
 * @public
 */

import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface CreateReportInput {
  readonly targetUri: string;
  readonly targetCollection: string;
  readonly reason: 'spam' | 'inappropriate' | 'copyright' | 'misinformation' | 'other';
  readonly description?: string;
}

interface CreateReportOutput {
  readonly success: boolean;
  readonly id: number;
}

export const createReport: XRPCMethod<void, CreateReportInput, CreateReportOutput> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<CreateReportOutput>> => {
    const user = c.get('user');
    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    if (!input?.targetUri || !input.targetCollection || !input.reason) {
      throw new ValidationError(
        'targetUri, targetCollection, and reason are required',
        'input',
        'required'
      );
    }

    const validReasons = ['spam', 'inappropriate', 'copyright', 'misinformation', 'other'];
    if (!validReasons.includes(input.reason)) {
      throw new ValidationError('Invalid reason', 'reason', 'enum');
    }

    // Validate AT-URI format: at://did:method:id/collection/rkey
    if (!input.targetUri.startsWith('at://')) {
      throw new ValidationError('targetUri must be a valid AT-URI', 'targetUri', 'format');
    }

    // Validate collection NSID format
    if (!/^[a-z]+\.[a-z]+\.[a-z]+/.test(input.targetCollection)) {
      throw new ValidationError(
        'targetCollection must be a valid NSID',
        'targetCollection',
        'format'
      );
    }

    // Limit description length
    const MAX_DESCRIPTION_LENGTH = 2000;
    if (input.description && input.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new ValidationError(
        `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
        'description',
        'maxLength'
      );
    }

    const reportService = c.get('services').contentReport;
    if (!reportService) {
      throw new ValidationError(
        'Content report service is not configured',
        'service',
        'unavailable'
      );
    }

    const report = await reportService.createReport({
      reporterDid: user.did,
      targetUri: input.targetUri,
      targetCollection: input.targetCollection,
      reason: input.reason,
      description: input.description,
    });

    const logger = c.get('logger');
    logger.info('Content report created', {
      reportId: report.id,
      targetUri: input.targetUri,
      reason: input.reason,
    });

    return {
      encoding: 'application/json',
      body: { success: true, id: report.id },
    };
  },
};
