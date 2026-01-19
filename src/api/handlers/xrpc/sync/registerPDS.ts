/**
 * PDS Registration handler.
 *
 * @remarks
 * Allows users to register a PDS for scanning. This ensures records
 * from non-relay PDSes can be discovered and indexed.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { ServiceUnavailableError, ValidationError } from '../../../../types/errors.js';
import {
  registerPDSInputSchema,
  registerPDSResponseSchema,
  type RegisterPDSInput,
  type RegisterPDSResponse,
} from '../../../schemas/sync.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.sync.registerPDS.
 *
 * @param c - Hono context
 * @param input - Request input
 * @returns Registration result
 *
 * @throws {ServiceUnavailableError} When PDS registry service is not available
 * @throws {ValidationError} When PDS URL is invalid or unreachable
 *
 * @public
 */
export async function registerPDSHandler(
  c: Context<ChiveEnv>,
  input: RegisterPDSInput
): Promise<RegisterPDSResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const registry = c.get('services').pdsRegistry;
  const scanner = c.get('services').pdsScanner;

  // Normalize URL (remove trailing slash)
  const pdsUrl = input.pdsUrl.replace(/\/$/, '');

  logger.info('PDS registration request', { pdsUrl });

  // Check if registry service is available
  if (!registry) {
    throw new ServiceUnavailableError('PDS registration is not currently available', 'pdsRegistry');
  }

  // Check if PDS is already registered
  const existing = await registry.getPDS(pdsUrl);

  if (existing) {
    logger.debug('PDS already registered', { pdsUrl, status: existing.status });

    // Even if PDS is registered, scan the authenticated user's DID
    // This ensures their historical records get indexed
    let recordsIndexed = 0;
    if (user && scanner) {
      try {
        logger.info('Scanning authenticated user DID on existing PDS', { pdsUrl, did: user.did });
        recordsIndexed = await scanner.scanDID(pdsUrl, user.did);
        logger.info('User DID scan completed', { pdsUrl, did: user.did, recordsIndexed });
      } catch (error) {
        logger.warn('Failed to scan user DID', {
          pdsUrl,
          did: user.did,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      pdsUrl,
      registered: true,
      status: recordsIndexed > 0 ? 'scanned' : 'already_exists',
      message:
        recordsIndexed > 0
          ? `${recordsIndexed} record(s) indexed from your account.`
          : `PDS is already registered with status: ${existing.status}`,
    };
  }

  // Validate that the URL is reachable
  try {
    const response = await fetch(`${pdsUrl}/xrpc/com.atproto.server.describeServer`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.warn('PDS validation failed - not reachable', { pdsUrl, status: response.status });
      throw new ValidationError('PDS does not appear to be reachable', 'pdsUrl', 'unreachable');
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.warn('PDS validation failed - network error', {
      pdsUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ValidationError(
      'Could not connect to PDS',
      'pdsUrl',
      'connection_failed',
      error instanceof Error ? error : undefined
    );
  }

  // Register the PDS
  await registry.registerPDS(pdsUrl, 'user_registration');

  logger.info('PDS registered successfully', { pdsUrl });

  // If user is authenticated and scanner is available, scan their DID immediately
  let recordsIndexed = 0;
  if (user && scanner) {
    try {
      logger.info('Scanning authenticated user DID', { pdsUrl, did: user.did });
      recordsIndexed = await scanner.scanDID(pdsUrl, user.did);
      logger.info('User DID scan completed', { pdsUrl, did: user.did, recordsIndexed });
    } catch (error) {
      logger.warn('Failed to scan user DID', {
        pdsUrl,
        did: user.did,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    pdsUrl,
    registered: true,
    status: recordsIndexed > 0 ? 'scanned' : 'pending',
    message:
      recordsIndexed > 0
        ? `PDS registered and ${recordsIndexed} record(s) indexed from your account.`
        : 'PDS registered successfully. It will be scanned shortly.',
  };
}

/**
 * XRPC endpoint definition for pub.chive.sync.registerPDS.
 *
 * @public
 */
export const registerPDSEndpoint: XRPCEndpoint<RegisterPDSInput, RegisterPDSResponse> = {
  method: 'pub.chive.sync.registerPDS' as never,
  type: 'procedure',
  description: 'Register a PDS for scanning to discover Chive records',
  inputSchema: registerPDSInputSchema,
  outputSchema: registerPDSResponseSchema,
  handler: registerPDSHandler,
  auth: 'optional', // Allow authenticated users to prioritize their PDS
  rateLimit: 'authenticated',
};
