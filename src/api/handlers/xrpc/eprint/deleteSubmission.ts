/**
 * XRPC handler for pub.chive.eprint.deleteSubmission.
 *
 * @remarks
 * Validates that the user is authorized to delete the eprint and returns
 * the information needed for the frontend to make the actual PDS deletion.
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
 * For traditional eprints (no paperDid), only the submitter can delete.
 * For paper-centric eprints (paperDid is set), the user must be authenticated
 * as the paper account to delete.
 *
 * After successful authorization, the frontend should:
 * 1. Call com.atproto.repo.deleteRecord on the appropriate PDS
 * 2. The firehose will propagate the deletion to Chive's index
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

    // Authorization: must be submitter or paper account
    if (eprintData.submittedBy !== user.did && eprintData.paperDid !== user.did) {
      throw new AuthorizationError('Can only delete your own eprints');
    }

    // For paper-centric eprints, must be authenticated as paper account
    if (eprintData.paperDid && user.did !== eprintData.paperDid) {
      throw new AuthorizationError(
        'Must authenticate as paper account to delete paper-centric eprints'
      );
    }

    logger.info('Delete submission authorized', {
      uri,
      did: user.did,
      recordOwner,
      isPaperCentric: !!eprintData.paperDid,
    });

    // Authorization successful. The frontend should now:
    // 1. Call com.atproto.repo.deleteRecord on recordOwner's PDS
    // 2. The deletion will propagate through the firehose
    // 3. Chive will remove the record from its index via indexEprintDelete

    return {
      encoding: 'application/json',
      body: { success: true },
    };
  },
};
