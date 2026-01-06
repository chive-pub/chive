/**
 * Repository-specific error types for AT Protocol operations.
 *
 * @remarks
 * These errors are thrown by the ATRepository implementation when fetching
 * records or blobs from user PDSes fails. They provide granular error
 * information for debugging and user feedback.
 *
 * @packageDocumentation
 * @public
 */

import { ChiveError } from '../../types/errors.js';

/**
 * Error thrown when a PDS is unreachable or returns an unexpected response.
 *
 * @remarks
 * This error indicates network-level failures when communicating with a
 * user's Personal Data Server (PDS). Common causes include:
 * - PDS is offline or unreachable
 * - Network timeout
 * - DNS resolution failure
 * - TLS certificate errors
 * - Unexpected HTTP status codes
 *
 * @example
 * ```typescript
 * try {
 *   await repository.getRecord(uri);
 * } catch (error) {
 *   if (error instanceof PDSConnectionError) {
 *     logger.warn('PDS unreachable', { pdsUrl: error.pdsUrl, statusCode: error.statusCode });
 *   }
 * }
 * ```
 *
 * @public
 */
export class PDSConnectionError extends ChiveError {
  readonly code = 'PDS_CONNECTION_ERROR';

  /**
   * PDS URL that was being accessed.
   */
  readonly pdsUrl: string;

  /**
   * HTTP status code if available.
   *
   * @remarks
   * Present when the PDS returned an HTTP response. Absent for network-level
   * failures like timeout or connection refused.
   */
  readonly statusCode?: number;

  /**
   * Creates a new PDSConnectionError.
   *
   * @param message - Description of the connection failure
   * @param pdsUrl - URL of the PDS that failed
   * @param statusCode - HTTP status code (if available)
   * @param cause - Original error (if chained)
   */
  constructor(message: string, pdsUrl: string, statusCode?: number, cause?: Error) {
    super(message, cause);
    this.pdsUrl = pdsUrl;
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when DID resolution fails.
 *
 * @remarks
 * This error indicates failure to resolve a DID to its DID document or
 * to extract the PDS endpoint from the DID document. Common causes include:
 * - Invalid DID format
 * - DID method not supported (only did:plc and did:web)
 * - PLC directory unreachable
 * - DID document missing PDS service entry
 *
 * @example
 * ```typescript
 * try {
 *   const pdsUrl = await identity.getPDSEndpoint(did);
 * } catch (error) {
 *   if (error instanceof IdentityResolutionError) {
 *     logger.error('Cannot resolve DID', { did: error.did, reason: error.reason });
 *   }
 * }
 * ```
 *
 * @public
 */
export class IdentityResolutionError extends ChiveError {
  readonly code = 'IDENTITY_RESOLUTION_ERROR';

  /**
   * DID that failed to resolve.
   */
  readonly did: string;

  /**
   * Reason for resolution failure.
   */
  readonly reason:
    | 'invalid_format'
    | 'unsupported_method'
    | 'not_found'
    | 'network_error'
    | 'no_pds';

  /**
   * Creates a new IdentityResolutionError.
   *
   * @param message - Description of the resolution failure
   * @param did - DID that failed to resolve
   * @param reason - Specific reason for failure
   * @param cause - Original error (if chained)
   */
  constructor(
    message: string,
    did: string,
    reason: IdentityResolutionError['reason'],
    cause?: Error
  ) {
    super(message, cause);
    this.did = did;
    this.reason = reason;
  }
}

/**
 * Error thrown when record fetching fails.
 *
 * @remarks
 * This error indicates failure to fetch a specific record from a user's PDS.
 * The record may exist but be inaccessible, or may not exist at all.
 *
 * @example
 * ```typescript
 * try {
 *   const record = await repository.getRecord(uri);
 * } catch (error) {
 *   if (error instanceof RecordFetchError) {
 *     logger.warn('Record fetch failed', { uri: error.uri, reason: error.reason });
 *   }
 * }
 * ```
 *
 * @public
 */
export class RecordFetchError extends ChiveError {
  readonly code = 'RECORD_FETCH_ERROR';

  /**
   * AT URI of the record that failed to fetch.
   */
  readonly uri: string;

  /**
   * Reason for fetch failure.
   */
  readonly reason: 'not_found' | 'pds_error' | 'network_error' | 'parse_error';

  /**
   * Creates a new RecordFetchError.
   *
   * @param message - Description of the fetch failure
   * @param uri - AT URI of the record
   * @param reason - Specific reason for failure
   * @param cause - Original error (if chained)
   */
  constructor(message: string, uri: string, reason: RecordFetchError['reason'], cause?: Error) {
    super(message, cause);
    this.uri = uri;
    this.reason = reason;
  }
}

/**
 * Error thrown when blob fetching fails.
 *
 * @remarks
 * This error indicates failure to fetch a blob (PDF, image, etc.) from a
 * user's PDS. The blob may exist but be inaccessible, or may not exist.
 *
 * @example
 * ```typescript
 * try {
 *   const stream = await repository.getBlob(did, cid);
 * } catch (error) {
 *   if (error instanceof BlobFetchError) {
 *     logger.warn('Blob fetch failed', { cid: error.cid, reason: error.reason });
 *   }
 * }
 * ```
 *
 * @public
 */
export class BlobFetchError extends ChiveError {
  readonly code = 'BLOB_FETCH_ERROR';

  /**
   * CID of the blob that failed to fetch.
   */
  readonly cid: string;

  /**
   * DID of the repository owner.
   */
  readonly did: string;

  /**
   * Reason for fetch failure.
   */
  readonly reason: 'not_found' | 'pds_error' | 'network_error' | 'too_large';

  /**
   * Creates a new BlobFetchError.
   *
   * @param message - Description of the fetch failure
   * @param did - DID of the repository owner
   * @param cid - CID of the blob
   * @param reason - Specific reason for failure
   * @param cause - Original error (if chained)
   */
  constructor(
    message: string,
    did: string,
    cid: string,
    reason: BlobFetchError['reason'],
    cause?: Error
  ) {
    super(message, cause);
    this.did = did;
    this.cid = cid;
    this.reason = reason;
  }
}
