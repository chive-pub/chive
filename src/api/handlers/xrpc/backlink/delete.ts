/**
 * Handler for pub.chive.backlink.delete.
 *
 * @remarks
 * Deletes (marks as deleted) a backlink record. Internal/plugin use only.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import { AuthenticationError } from '../../../../types/errors.js';
import { deleteBacklinkInputSchema, type DeleteBacklinkInput } from '../../../schemas/backlink.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Response schema for delete operation.
 */
const deleteBacklinkResponseSchema = z.object({
  success: z.boolean(),
});

type DeleteBacklinkResponse = z.infer<typeof deleteBacklinkResponseSchema>;

/**
 * Handler for pub.chive.backlink.delete.
 *
 * @param c - Hono context
 * @param input - Backlink to delete
 * @returns Success indicator
 *
 * @public
 */
export async function deleteBacklinkHandler(
  c: Context<ChiveEnv>,
  input: DeleteBacklinkInput
): Promise<DeleteBacklinkResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { backlink } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.debug('Deleting backlink', { sourceUri: input.sourceUri });

  await backlink.deleteBacklink(input.sourceUri);

  return { success: true };
}

/**
 * Endpoint definition for pub.chive.backlink.delete.
 *
 * @public
 */
export const deleteBacklinkEndpoint: XRPCEndpoint<DeleteBacklinkInput, DeleteBacklinkResponse> = {
  method: 'pub.chive.backlink.delete' as never,
  type: 'procedure',
  description: 'Delete a backlink record (internal/plugin use)',
  inputSchema: deleteBacklinkInputSchema,
  outputSchema: deleteBacklinkResponseSchema,
  handler: deleteBacklinkHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
