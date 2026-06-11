/**
 * XRPC handler for pub.chive.eprint.deleteSubmission.
 *
 * @remarks
 * Validates that the user is authorized to delete the eprint and returns
 * the information needed for the frontend to make the actual PDS deletion.
 * Authorization is granted to the original submitter, the paper account
 * (if paper-centric), or any author whose DID appears in the eprint's
 * authors array.
 *
 * **ATProto Architecture:**
 * Chive is an AppView and does not write to user PDSes. This handler validates
 * authorization; the actual deletion happens via the frontend ATProto client
 * calling the user's (or paper's) PDS directly.
 *
 * **Paper PDS Model:**
 * - Traditional: `paperDid` is undefined, record is in submitter's PDS
 * - Paper-Centric: `paperDid` is set, record is in paper's PDS
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/eprint/deleteSubmission.js';
import type { AtUri } from '../../../../types/atproto.js';
import { AuthorizationError, NotFoundError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.eprint.deleteSubmission.
 *
 * @remarks
 * Validates that the authenticated user has permission to delete the eprint.
 *
 * For traditional eprints (no paperDid), the submitter or any author whose
 * DID appears in the authors array can delete.
 * For paper-centric eprints (paperDid is set), the user must be authenticated
 * as the paper account to delete.
 *
 * After successful authorization, this handler removes the eprint from Chive's
 * own indexes immediately (deleting from the AppView's index is compliant; we
 * never write to the user's PDS). The frontend then:
 * 1. Calls com.atproto.repo.deleteRecord on the appropriate PDS
 * 2. The firehose delete reconciles the index (idempotent with the above)
 *
 * @example
 * ```http
 * POST /xrpc/pub.chive.eprint.deleteSubmission
 * Content-Type: application/json
 *
 * {
 *   "uri": "at://did:plc:abc/pub.chive.eprint.submission/xyz"
 * }
 *
 * Response:
 * {
 *   "success": true
 * }
 * ```
 *
 * @public
 */
export const deleteSubmission: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { eprint } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!user) {
      throw new AuthorizationError('Authentication required');
    }

    if (!input) {
      throw new ValidationError('Missing request body', 'body');
    }

    const { uri } = input;

    if (!uri) {
      throw new ValidationError('Missing required parameter: uri', 'uri');
    }

    logger.debug('Delete submission request', { uri, did: user.did });

    // Fetch the eprint to verify ownership
    const eprintData = await eprint.getEprint(uri as AtUri);

    if (!eprintData) {
      throw new NotFoundError('Eprint', uri);
    }

    // Determine the record owner (paper PDS or submitter PDS)
    const recordOwner = eprintData.paperDid ?? eprintData.submittedBy;

    // Authorization: must be submitter, paper account, or listed author
    const isSubmitter = eprintData.submittedBy === user.did;
    const isPaperAccount = eprintData.paperDid === user.did;
    const isAuthor = eprintData.authors?.some((a: { did?: string }) => a.did === user.did) ?? false;

    if (!isSubmitter && !isPaperAccount && !isAuthor) {
      throw new AuthorizationError('Not authorized to modify this eprint');
    }

    // For paper-centric eprints, must be authenticated as paper account
    // (even authors must auth as paper account to write to paper's PDS)
    if (eprintData.paperDid && user.did !== eprintData.paperDid) {
      throw new AuthorizationError(
        'Must authenticate as paper account to modify paper-centric eprints'
      );
    }

    logger.info('Delete submission authorized', {
      uri,
      did: user.did,
      recordOwner,
      isPaperCentric: !!eprintData.paperDid,
    });

    // Remove the eprint from Chive's own indexes immediately rather than
    // waiting for the firehose delete event. Deleting from the AppView's own
    // index is ATProto-compliant (we never touch the user's PDS), and it makes
    // deletion reliable even when firehose ingestion is lagging or down: the
    // firehose delete remains the source of truth and is idempotent with this.
    const deleteResult = await eprint.indexEprintDelete(uri as AtUri);
    if (!deleteResult.ok) {
      // Surface the failure so the frontend does not report success while the
      // eprint is still indexed.
      logger.error('Failed to remove eprint from index', deleteResult.error, { uri });
      throw deleteResult.error;
    }

    // The frontend still deletes the record from the owner's PDS via
    // com.atproto.repo.deleteRecord; the firehose delete reconciles the index.

    return {
      encoding: 'application/json',
      body: { success: true },
    };
  },
};
