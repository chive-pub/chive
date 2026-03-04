/**
 * XRPC handler for pub.chive.admin.updateAlphaApplication.
 *
 * @remarks
 * Updates an alpha application status (approve, reject, revoke).
 * Also manages Redis roles and sends email notifications on approval.
 * Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { adminMetrics } from '../../../../observability/prometheus-registry.js';
import {
  AuthorizationError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface UpdateAlphaInput {
  readonly did: string;
  readonly action: 'approve' | 'reject' | 'revoke';
}

export const updateAlphaApplication: XRPCMethod<void, UpdateAlphaInput, unknown> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!input?.did || !input.action) {
      throw new ValidationError('DID and action are required', 'input', 'required');
    }

    const validActions = ['approve', 'reject', 'revoke'] as const;
    if (!validActions.includes(input.action)) {
      throw new ValidationError(`Invalid action: ${input.action}`, 'action', 'enum');
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }
    const updated = await admin.updateAlphaApplication(input.did, input.action, user.did);

    if (!updated) {
      throw new NotFoundError('AlphaApplication', input.did);
    }

    // Manage Redis roles
    const redis = c.get('redis');
    const roleKey = `chive:authz:roles:${input.did}`;

    if (input.action === 'approve') {
      await redis.sadd(roleKey, 'alpha-tester');
    } else if (input.action === 'reject' || input.action === 'revoke') {
      await redis.srem(roleKey, 'alpha-tester');
    }

    const logger = c.get('logger');

    // Send email notification on approval (best-effort)
    if (input.action === 'approve' && updated.email) {
      try {
        const { createEmailServiceFromEnv } =
          await import('../../../../services/email/email-service.js');
        const { renderAlphaApprovalEmail } =
          await import('../../../../services/email/templates/alpha-approval.js');

        const emailService = createEmailServiceFromEnv(logger);
        const zulipInviteUrl = process.env.ZULIP_INVITE_URL;

        if (emailService && zulipInviteUrl) {
          const emailContent = renderAlphaApprovalEmail({
            handle: updated.handle ?? undefined,
            email: updated.email,
            zulipInviteUrl,
          });
          await emailService.sendEmail({
            to: updated.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });
          logger.info('Approval email sent', { did: input.did, email: updated.email });
        }
      } catch (error) {
        logger.warn('Failed to send approval email', {
          did: input.did,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    adminMetrics.actionsTotal.inc({ action: input.action, target: 'alpha_application' });

    logger.info('Alpha application updated via admin dashboard', {
      did: input.did,
      action: input.action,
      reviewer: user.did,
    });

    return { encoding: 'application/json', body: updated };
  },
};
