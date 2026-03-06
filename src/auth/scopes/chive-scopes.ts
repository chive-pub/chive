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
  // Eprint collections
  EPRINT_SUBMISSION: 'repo:pub.chive.eprint.submission',
  EPRINT_VERSION: 'repo:pub.chive.eprint.version',
  EPRINT_USER_TAG: 'repo:pub.chive.eprint.userTag',
  EPRINT_CITATION: 'repo:pub.chive.eprint.citation',
  EPRINT_RELATED_WORK: 'repo:pub.chive.eprint.relatedWork',
  EPRINT_CHANGELOG: 'repo:pub.chive.eprint.changelog',

  // Actor collections
  ACTOR_PROFILE: 'repo:pub.chive.actor.profile',
  ACTOR_PROFILE_CONFIG: 'repo:pub.chive.actor.profileConfig',

  // Discovery collections
  DISCOVERY_SETTINGS: 'repo:pub.chive.discovery.settings',

  // Review collections
  REVIEW_COMMENT: 'repo:pub.chive.review.comment',
  REVIEW_ENDORSEMENT: 'repo:pub.chive.review.endorsement',

  // Annotation collections
  ANNOTATION_COMMENT: 'repo:pub.chive.annotation.comment',
  ANNOTATION_ENTITY_LINK: 'repo:pub.chive.annotation.entityLink',

  // Graph collections
  GRAPH_FIELD_PROPOSAL: 'repo:pub.chive.graph.fieldProposal',
  GRAPH_NODE_PROPOSAL: 'repo:pub.chive.graph.nodeProposal',
  GRAPH_EDGE_PROPOSAL: 'repo:pub.chive.graph.edgeProposal',
  GRAPH_VOTE: 'repo:pub.chive.graph.vote',
  GRAPH_NODE: 'repo:pub.chive.graph.node',
  GRAPH_EDGE: 'repo:pub.chive.graph.edge',
} as const;

/**
 * Repo scopes for external namespaces that Chive cross-posts to.
 *
 * @remarks
 * These are outside the pub.chive.* namespace and must be requested
 * as individual scopes alongside the Chive permission sets.
 */
export const EXTERNAL_REPO_SCOPES = {
  BLUESKY_POST: 'repo:app.bsky.feed.post',
  BLUESKY_PROFILE: 'repo:app.bsky.actor.profile',
  STANDARD_DOCUMENT: 'repo:site.standard.document',
  COSMIK_CARD: 'repo:network.cosmik.card',
  COSMIK_COLLECTION_LINK: 'repo:network.cosmik.collectionLink',
  COSMIK_COLLECTION: 'repo:network.cosmik.collection',
} as const;

/** Blob scopes for file uploads. */
export const BLOB_SCOPES = {
  APPLICATION: 'blob:application/*',
  IMAGE: 'blob:image/*',
  VIDEO: 'blob:video/*',
  AUDIO: 'blob:audio/*',
  TEXT: 'blob:text/*',
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
 * backward compatibility and external namespace scopes for cross-posting.
 */
export const CLIENT_METADATA_SCOPE = buildScopeString([
  LEGACY_SCOPE,
  PERMISSION_SETS.FULL_ACCESS,
  ...Object.values(EXTERNAL_REPO_SCOPES),
]);
