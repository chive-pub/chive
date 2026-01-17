/**
 * Notification API schemas.
 *
 * @remarks
 * Zod schemas for notification-related API requests and responses.
 * Notifications include reviews and endorsements on user's papers.
 *
 * @packageDocumentation
 * @public
 */

import { z } from './base.js';
import { atUriSchema, didSchema, paginationQuerySchema } from './common.js';

/**
 * Review notification schema.
 *
 * @public
 */
export const reviewNotificationSchema = z.object({
  uri: atUriSchema.describe('Review AT-URI'),
  reviewerDid: didSchema.describe('Reviewer DID'),
  reviewerHandle: z.string().optional().describe('Reviewer handle'),
  reviewerDisplayName: z.string().optional().describe('Reviewer display name'),
  eprintUri: atUriSchema.describe('Eprint AT-URI'),
  eprintTitle: z.string().describe('Eprint title'),
  text: z.string().describe('Review text content'),
  isReply: z.boolean().describe('Whether this is a reply'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
});

/**
 * Review notification type.
 *
 * @public
 */
export type ReviewNotification = z.infer<typeof reviewNotificationSchema>;

/**
 * Endorsement type for notifications.
 *
 * @public
 */
export const notificationEndorsementTypeSchema = z.enum(['methods', 'results', 'overall']);

/**
 * Endorsement notification schema.
 *
 * @public
 */
export const endorsementNotificationSchema = z.object({
  uri: atUriSchema.describe('Endorsement AT-URI'),
  endorserDid: didSchema.describe('Endorser DID'),
  endorserHandle: z.string().optional().describe('Endorser handle'),
  endorserDisplayName: z.string().optional().describe('Endorser display name'),
  eprintUri: atUriSchema.describe('Eprint AT-URI'),
  eprintTitle: z.string().describe('Eprint title'),
  endorsementType: notificationEndorsementTypeSchema.describe('Endorsement type'),
  comment: z.string().optional().describe('Optional comment'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
});

/**
 * Endorsement notification type.
 *
 * @public
 */
export type EndorsementNotification = z.infer<typeof endorsementNotificationSchema>;

/**
 * List review notifications params schema.
 *
 * @public
 */
export const listReviewNotificationsParamsSchema = paginationQuerySchema;

/**
 * List review notifications params type.
 *
 * @public
 */
export type ListReviewNotificationsParams = z.infer<typeof listReviewNotificationsParamsSchema>;

/**
 * List endorsement notifications params schema.
 *
 * @public
 */
export const listEndorsementNotificationsParamsSchema = paginationQuerySchema;

/**
 * List endorsement notifications params type.
 *
 * @public
 */
export type ListEndorsementNotificationsParams = z.infer<
  typeof listEndorsementNotificationsParamsSchema
>;

/**
 * Review notifications response schema.
 *
 * @public
 */
export const reviewNotificationsResponseSchema = z.object({
  notifications: z.array(reviewNotificationSchema).describe('List of review notifications'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().optional().describe('Total count'),
});

/**
 * Review notifications response type.
 *
 * @public
 */
export type ReviewNotificationsResponse = z.infer<typeof reviewNotificationsResponseSchema>;

/**
 * Endorsement notifications response schema.
 *
 * @public
 */
export const endorsementNotificationsResponseSchema = z.object({
  notifications: z
    .array(endorsementNotificationSchema)
    .describe('List of endorsement notifications'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().optional().describe('Total count'),
});

/**
 * Endorsement notifications response type.
 *
 * @public
 */
export type EndorsementNotificationsResponse = z.infer<
  typeof endorsementNotificationsResponseSchema
>;
