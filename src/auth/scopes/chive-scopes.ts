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
  ACTOR_MUTE: 'repo:pub.chive.actor.mute',

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

  // Collaboration collections
  COLLABORATION_INVITE: 'repo:pub.chive.collaboration.invite',
  COLLABORATION_INVITE_ACCEPTANCE: 'repo:pub.chive.collaboration.inviteAcceptance',
} as const;

/**
 * External-namespace scopes for cross-posting and cooperating apps.
 *
 * @remarks
 * Where the cooperating app publishes a `permission-set` lexicon (Margin,
 * site.standard), we prefer `include:<nsid>` so the consent screen renders
 * one named entry with publisher-authored copy. For Semble the published
 * `network.cosmik.authFull` set is missing two collections (`connection`,
 * `follow`) that Chive writes, so we use a hybrid: include + supplementary
 * repo scopes for the gaps. Bluesky has no covering permission set.
 */
export const EXTERNAL_REPO_SCOPES = {
  // Bluesky -- no permission set published
  BLUESKY_POST: 'repo:app.bsky.feed.post',
  BLUESKY_PROFILE: 'repo:app.bsky.actor.profile',

  // Standard (site.standard) -- covered by the published authFull set
  STANDARD_FULL: 'include:site.standard.authFull',

  // Semble (network.cosmik) -- authFull covers card/collection/collectionLink/
  // collectionLinkRemoval; the two below are needed because Semble's authFull
  // omits them.
  COSMIK_FULL: 'include:network.cosmik.authFull',
  COSMIK_CONNECTION: 'repo:network.cosmik.connection',
  COSMIK_FOLLOW: 'repo:network.cosmik.follow',

  // Margin (at.margin) -- authFull covers note/reply/like/collection/
  // collectionItem/profile/preferences/apikey
  MARGIN_FULL: 'include:at.margin.authFull',
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
  BASIC_READER: `include:pub.chive.basicReader?aud=${CHIVE_SERVICE_DID}`,
  AUTHOR_ACCESS: `include:pub.chive.authorAccess?aud=${CHIVE_SERVICE_DID}`,
  REVIEWER_ACCESS: `include:pub.chive.reviewerAccess?aud=${CHIVE_SERVICE_DID}`,
  FULL_ACCESS: `include:pub.chive.fullAccess?aud=${CHIVE_SERVICE_DID}`,
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
 * Individual login requests use a subset. Uses individual `repo:` scopes
 * rather than `include:` permission set references because the PDS cannot
 * resolve our permission set lexicons until they are published. Does NOT
 * include `transition:generic` because that scope bypasses granular
 * permissions entirely and causes consent screens to display "any public
 * record" instead of the specific collections we actually need. Once the
 * permission set lexicons are published, this can be replaced with
 * `PERMISSION_SETS.FULL_ACCESS`.
 */
export const CLIENT_METADATA_SCOPE = buildScopeString([
  ...Object.values(REPO_SCOPES),
  ...Object.values(EXTERNAL_REPO_SCOPES),
]);
