/**
 * Handler for pub.chive.backlink.create.
 *
 * @remarks
 * Creates a backlink record. Internal/plugin use only.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  createBacklinkInputSchema,
  backlinkSchema,
  type CreateBacklinkInput,
  type Backlink,
} from '../../../schemas/backlink.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.backlink.create.
 *
 * @param c - Hono context
 * @param input - Backlink data to create
 * @returns Created backlink
 *
 * @public
 */
export async function createBacklinkHandler(
  c: Context<ChiveEnv>,
  input: CreateBacklinkInput
): Promise<Backlink> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { backlink } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.debug('Creating backlink', {
    sourceUri: input.sourceUri,
    sourceType: input.sourceType,
    targetUri: input.targetUri,
  });

  const result = await backlink.createBacklink({
    sourceUri: input.sourceUri,
    sourceType: input.sourceType,
    targetUri: input.targetUri,
    context: input.context,
  });

  return {
    id: result.id,
    sourceUri: result.sourceUri,
    sourceType: result.sourceType,
    targetUri: result.targetUri,
    context: result.context,
    indexedAt: result.indexedAt.toISOString(),
    deleted: result.deleted,
  };
}

/**
 * Endpoint definition for pub.chive.backlink.create.
 *
 * @public
 */
export const createBacklinkEndpoint: XRPCEndpoint<CreateBacklinkInput, Backlink> = {
  method: 'pub.chive.backlink.create' as never,
  type: 'procedure',
  description: 'Create a backlink record (internal/plugin use)',
  inputSchema: createBacklinkInputSchema,
  outputSchema: backlinkSchema,
  handler: createBacklinkHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
