/**
 * XRPC handler for pub.chive.sync.registerPDS.
 *
 * @remarks
 * Allows an authenticated user to register the PDS they belong to for
 * scanning. This ensures records from non-relay PDSes can be discovered
 * and indexed.
 *
 * Registration is authenticated: a registered host is later enumerated by
 * the PDS scanner, which indexes whatever repos that host claims to hold,
 * so an anonymous caller must not be able to add arbitrary hosts to the
 * scan registry.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/sync/registerPDS.js';
import type { DID } from '../../../../types/atproto.js';
import {
  AuthenticationError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Resolves the PDS endpoint recorded in a DID document.
 *
 * @remarks
 * Mirrors the resolution used by the `indexRecord` handler. Returns `null`
 * when the DID cannot be resolved — a directory outage, an unsupported DID
 * method, or a document without an `#atproto_pds` service — so callers can
 * treat the result as inconclusive rather than as a mismatch.
 *
 * @param did - DID whose PDS endpoint should be resolved
 * @returns The PDS endpoint URL, or null if it could not be determined
 */
async function resolvePdsEndpoint(did: DID): Promise<string | null> {
  try {
    if (did.startsWith('did:plc:')) {
      const response = await fetch(`https://plc.directory/${did}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        return null;
      }
      const doc = (await response.json()) as {
        service?: { id: string; type: string; serviceEndpoint: string }[];
      };
      const pdsService = doc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      return pdsService?.serviceEndpoint ?? null;
    }

    if (did.startsWith('did:web:')) {
      const domain = did.replace('did:web:', '').replace(/%3A/g, ':');
      const response = await fetch(`https://${domain}/.well-known/did.json`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        return null;
      }
      const doc = (await response.json()) as {
        service?: { id: string; type: string; serviceEndpoint: string }[];
      };
      const pdsService = doc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      return pdsService?.serviceEndpoint ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts the host (hostname and port) of a URL for comparison.
 *
 * @param url - URL string to parse
 * @returns Lowercased host, or null if the string is not a parseable URL
 */
function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * XRPC method for pub.chive.sync.registerPDS.
 *
 * @public
 */
export const registerPDS: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const registry = c.get('services').pdsRegistry;
    const scanner = c.get('services').pdsScanner;

    if (!input) {
      throw new ValidationError('Input required', 'pdsUrl');
    }

    // Normalize URL (remove trailing slash)
    const pdsUrl = input.pdsUrl.replace(/\/$/, '');

    logger.info('PDS registration request', { pdsUrl });

    // Check if registry service is available
    if (!registry) {
      throw new ServiceUnavailableError(
        'PDS registration is not currently available',
        'pdsRegistry'
      );
    }

    // Defense in depth: `auth: true` makes the XRPC adapter reject
    // unauthenticated requests before this handler runs, so this restates the
    // invariant for direct invocation. It is checked after the registry probe
    // so an unavailable registry still reports service unavailability.
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    // Check if PDS is already registered
    const existing = await registry.getPDS(pdsUrl);

    if (existing) {
      logger.debug('PDS already registered', { pdsUrl, status: existing.status });

      // Even if PDS is registered, scan the authenticated user's DID
      // This ensures their historical records get indexed
      let recordsIndexed = 0;
      if (scanner) {
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

      const body: OutputSchema = {
        pdsUrl,
        registered: true,
        status: recordsIndexed > 0 ? 'scanned' : 'already_exists',
        message:
          recordsIndexed > 0
            ? `${recordsIndexed} record(s) indexed from your account.`
            : `PDS is already registered with status: ${existing.status}`,
      };

      return { encoding: 'application/json', body };
    }

    // Registering a new host adds it to the scan registry, and the scanner
    // later indexes every repo that host claims to hold. Bind the registration
    // to the caller's own identity: the host must be the one named in the
    // caller's DID document.
    const callerPdsUrl = await resolvePdsEndpoint(user.did);
    const callerHost = callerPdsUrl ? hostOf(callerPdsUrl) : null;
    const requestedHost = hostOf(pdsUrl);

    if (callerHost && requestedHost && callerHost !== requestedHost) {
      logger.warn('Rejected PDS registration for a host the caller does not belong to', {
        pdsUrl,
        did: user.did,
        callerPdsUrl,
      });
      throw new ValidationError(
        'PDS URL does not match the PDS in your DID document',
        'pdsUrl',
        'not_your_pds'
      );
    }

    if (!callerHost) {
      // Resolution is inconclusive (directory outage, unsupported DID method,
      // or a document without a PDS service). Fail open so a transient outage
      // cannot block indexing, but leave a trace for auditing.
      logger.warn('Could not resolve caller PDS; registering without ownership check', {
        pdsUrl,
        did: user.did,
      });
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

    // If scanner is available, scan the authenticated user's DID immediately
    let recordsIndexed = 0;
    if (scanner) {
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

    const body: OutputSchema = {
      pdsUrl,
      registered: true,
      status: recordsIndexed > 0 ? 'scanned' : 'pending',
      message:
        recordsIndexed > 0
          ? `PDS registered and ${recordsIndexed} record(s) indexed from your account.`
          : 'PDS registered successfully. It will be scanned shortly.',
    };

    return { encoding: 'application/json', body };
  },
};
