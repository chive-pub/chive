/**
 * XRPC handler for pub.chive.eprint.updateSubmission.
 *
 * @remarks
 * Validates that the user is authorized to update the eprint and returns
 * the new version information for the frontend to use when making the
 * actual PDS update.
 *
 * **ATProto Architecture:**
 * Chive is an AppView and does not write to user PDSes. This handler validates
 * authorization and computes the new version; the actual update happens via
 * the frontend ATProto client calling the user's (or paper's) PDS directly.
 *
 * **Paper PDS Model:**
 * - Traditional: `paperDid` is undefined, record is in submitter's PDS
 * - Paper-Centric: `paperDid` is set, record is in paper's PDS
 *
 * **Version Semantics:**
 * - Major (X.0.0): Fundamental revision, retracted & replaced, major corrections
 * - Minor (1.X.0): New content, significant additions, new analysis
 * - Patch (1.0.X): Typo fixes, formatting, citation corrections
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/eprint/updateSubmission.js';
import type { AtUri } from '../../../../types/atproto.js';
import { AuthorizationError, NotFoundError, ValidationError } from '../../../../types/errors.js';
import {
  bumpVersion,
  type SemanticVersion,
  type VersionBumpType,
} from '../../../../utils/version.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.eprint.updateSubmission.
 *
 * @remarks
 * Validates that the authenticated user has permission to update the eprint
 * and computes the new semantic version.
 *
 * For traditional eprints (no paperDid), only the submitter can update.
 * For paper-centric eprints (paperDid is set), the user must be authenticated
 * as the paper account to update.
 *
 * After successful authorization, the frontend should:
 * 1. Build the updated record with the new version
 * 2. Call com.atproto.repo.putRecord on the appropriate PDS
 * 3. Optionally create a changelog record
 * 4. The firehose will propagate the update to Chive's index
 *
 * @example
 * ```http
 * POST /xrpc/pub.chive.eprint.updateSubmission
 * Content-Type: application/json
 *
 * {
 *   "uri": "at://did:plc:abc/pub.chive.eprint.submission/xyz",
 *   "versionBump": "minor",
 *   "title": "Updated Title",
 *   "changelog": {
 *     "summary": "Added new analysis section"
 *   }
 * }
 *
 * Response:
 * {
 *   "uri": "at://did:plc:abc/pub.chive.eprint.submission/xyz",
 *   "version": { "major": 1, "minor": 1, "patch": 0 },
 *   "expectedCid": "bafyreib..."
 * }
 * ```
 *
 * The frontend should use expectedCid with the PDS swapRecord parameter:
 * ```typescript
 * await agent.api.com.atproto.repo.putRecord({
 *   repo: recordOwner,
 *   collection: 'pub.chive.eprint.submission',
 *   rkey: extractRkey(uri),
 *   record: updatedRecord,
 *   swapRecord: expectedCid,  // Prevents race conditions
 * });
 * ```
 *
 * @public
 */
export const updateSubmission: XRPCMethod<void, InputSchema, OutputSchema> = {
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

    const { uri, versionBump, authors } = input;

    if (!uri) {
      throw new ValidationError('Missing required parameter: uri', 'uri');
    }

    if (!versionBump) {
      throw new ValidationError('Missing required parameter: versionBump', 'versionBump');
    }

    // Validate version bump value
    if (!['major', 'minor', 'patch'].includes(versionBump)) {
      throw new ValidationError(
        'versionBump must be one of: major, minor, patch',
        'versionBump',
        'invalid'
      );
    }

    // Validate authors if provided
    if (authors !== undefined) {
      if (!Array.isArray(authors) || authors.length === 0) {
        throw new ValidationError('authors must be a non-empty array', 'authors', 'invalid');
      }
      // Validate each author has required fields
      authors.forEach((author, i) => {
        if (!author?.name || typeof author.name !== 'string') {
          throw new ValidationError(`authors[${i}].name is required`, 'authors', 'invalid');
        }
        if (typeof author.order !== 'number' || author.order < 1) {
          throw new ValidationError(
            `authors[${i}].order must be a positive integer`,
            'authors',
            'invalid'
          );
        }
      });
    }

    logger.debug('Update submission request', {
      uri,
      versionBump,
      did: user.did,
      hasAuthors: !!authors,
      authorCount: authors?.length,
    });

    // Fetch the eprint to verify ownership and get current version
    const eprintData = await eprint.getEprint(uri as AtUri);

    if (!eprintData) {
      throw new NotFoundError('Eprint', uri);
    }

    // Determine the record owner (paper PDS or submitter PDS)
    const recordOwner = eprintData.paperDid ?? eprintData.submittedBy;

    // Authorization: must be submitter or paper account
    if (eprintData.submittedBy !== user.did && eprintData.paperDid !== user.did) {
      throw new AuthorizationError('Can only edit your own eprints');
    }

    // For paper-centric eprints, must be authenticated as paper account
    if (eprintData.paperDid && user.did !== eprintData.paperDid) {
      throw new AuthorizationError(
        'Must authenticate as paper account to edit paper-centric eprints'
      );
    }

    // Get current version (convert integer to semantic if needed)
    const currentVersion: SemanticVersion | undefined =
      typeof eprintData.version === 'number'
        ? { major: eprintData.version, minor: 0, patch: 0 }
        : (eprintData.version as SemanticVersion | undefined);

    // Compute new version
    const newVersion = bumpVersion(currentVersion, versionBump as VersionBumpType);

    logger.info('Update submission authorized', {
      uri,
      did: user.did,
      recordOwner,
      isPaperCentric: !!eprintData.paperDid,
      currentVersion,
      newVersion,
    });

    // Authorization successful. The frontend should now:
    // 1. Build the updated record with newVersion
    // 2. Call com.atproto.repo.putRecord on recordOwner's PDS with swapRecord set to expectedCid
    // 3. The update will propagate through the firehose
    // 4. Chive will update the record in its index via indexEprint
    //
    // Optimistic Concurrency Control:
    // The expectedCid is the CID of the currently indexed version. The frontend should pass this
    // to the PDS as the `swapRecord` parameter when calling putRecord. If another update occurred
    // between reading the version and writing the update, the CID will have changed and the PDS
    // will reject the update with a conflict error. This prevents lost updates due to race conditions.

    return {
      encoding: 'application/json',
      body: {
        uri,
        version: newVersion,
        expectedCid: eprintData.cid,
      },
    };
  },
};
