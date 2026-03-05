/**
 * Chive ATProto OAuth scope definitions.
 *
 * @remarks
 * Defines all Chive-specific scope strings following the ATProto granular
 * scopes specification. These map to repo collections, RPC endpoints,
 * and blob MIME types used by Chive.
 *
 * @see https://atproto.com/specs/permission
 * @packageDocumentation
 * @public
 */

/** Chive's service DID for audience targeting in RPC scopes. */
export const CHIVE_SERVICE_DID = 'did:web:chive.pub';

/** Individual repo scopes for pub.chive.* collections. */
export const REPO_SCOPES = {
  EPRINT_SUBMISSION: 'repo:pub.chive.eprint.submission',
  EPRINT_VERSION: 'repo:pub.chive.eprint.version',
  EPRINT_USER_TAG: 'repo:pub.chive.eprint.userTag',
  REVIEW_COMMENT: 'repo:pub.chive.review.comment',
  REVIEW_ENDORSEMENT: 'repo:pub.chive.review.endorsement',
  GRAPH_FIELD_PROPOSAL: 'repo:pub.chive.graph.fieldProposal',
  GRAPH_VOTE: 'repo:pub.chive.graph.vote',
} as const;

/** Blob scopes for file uploads. */
export const BLOB_SCOPES = {
  PDF: 'blob:application/pdf',
  IMAGE: 'blob:image/*',
} as const;

/**
 * Permission set scope references.
 *
 * @remarks
 * These follow the ATProto `include:` syntax to reference permission set
 * Lexicon schemas that bundle multiple granular scopes.
 */
export const PERMISSION_SETS = {
  BASIC_READER: 'include:pub.chive.auth.basicReader',
  AUTHOR_ACCESS: 'include:pub.chive.auth.authorAccess',
  REVIEWER_ACCESS: 'include:pub.chive.auth.reviewerAccess',
  FULL_ACCESS: 'include:pub.chive.auth.fullAccess',
} as const;

/** Legacy scope for backward compatibility with PDSes that don't support granular scopes. */
export const LEGACY_SCOPE = 'transition:generic';

/** ATProto base scope (always required). */
export const ATPROTO_BASE_SCOPE = 'atproto';

/**
 * Build a space-separated scope string from individual scope components.
 *
 * @param scopes - Array of scope strings to combine
 * @returns Space-separated scope string with 'atproto' prefix
 */
export function buildScopeString(scopes: readonly string[]): string {
  const all = new Set([ATPROTO_BASE_SCOPE, ...scopes]);
  return Array.from(all).join(' ');
}

/**
 * Default scope string for client metadata.
 *
 * @remarks
 * Client metadata declares the maximum set of scopes the app may request.
 * Individual login requests use a subset. Includes transition:generic for
 * backward compatibility.
 */
export const CLIENT_METADATA_SCOPE = buildScopeString([LEGACY_SCOPE, PERMISSION_SETS.FULL_ACCESS]);
