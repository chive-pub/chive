/**
 * Frontend ATProto OAuth scope utilities for Chive.
 *
 * @remarks
 * Provides intent-based scope selection and scope checking utilities
 * for the Chive frontend. Mirrors scope constants from the backend.
 */

/** Authorization intent determining the scope level requested during OAuth. */
export type AuthIntent = 'browse' | 'submit' | 'review' | 'full';

/**
 * Permission set scope references.
 *
 * @remarks
 * These use ATProto `include:` syntax to reference permission set lexicon
 * schemas. They are NOT currently used in OAuth requests because the PDS
 * must be able to resolve the lexicon NSID from our domain. Once we publish
 * lexicons via `/.well-known/atproto-lexicons/` or equivalent, these can
 * replace the individual `repo:` scopes below.
 */
export const PERMISSION_SETS = {
  BASIC_READER: 'include:pub.chive.auth.basicReader',
  AUTHOR_ACCESS: 'include:pub.chive.auth.authorAccess',
  REVIEWER_ACCESS: 'include:pub.chive.auth.reviewerAccess',
  FULL_ACCESS: 'include:pub.chive.auth.fullAccess',
} as const;

/**
 * Individual repo scopes for pub.chive.* collections.
 *
 * @remarks
 * Used directly in OAuth scope strings until we can publish permission set
 * lexicons that the PDS can resolve. Once `include:pub.chive.auth.*` works,
 * these can be replaced by the permission set references.
 */
export const CHIVE_REPO_SCOPES = {
  // Eprints
  EPRINT_SUBMISSION: 'repo:pub.chive.eprint.submission',
  EPRINT_VERSION: 'repo:pub.chive.eprint.version',
  EPRINT_USER_TAG: 'repo:pub.chive.eprint.userTag',
  EPRINT_CITATION: 'repo:pub.chive.eprint.citation',
  EPRINT_RELATED_WORK: 'repo:pub.chive.eprint.relatedWork',
  EPRINT_CHANGELOG: 'repo:pub.chive.eprint.changelog',

  // Actor
  ACTOR_PROFILE: 'repo:pub.chive.actor.profile',
  ACTOR_PROFILE_CONFIG: 'repo:pub.chive.actor.profileConfig',
  ACTOR_MUTE: 'repo:pub.chive.actor.mute',

  // Discovery
  DISCOVERY_SETTINGS: 'repo:pub.chive.discovery.settings',

  // Reviews
  REVIEW_COMMENT: 'repo:pub.chive.review.comment',
  REVIEW_ENDORSEMENT: 'repo:pub.chive.review.endorsement',

  // Annotations
  ANNOTATION_COMMENT: 'repo:pub.chive.annotation.comment',
  ANNOTATION_ENTITY_LINK: 'repo:pub.chive.annotation.entityLink',

  // Graph
  GRAPH_FIELD_PROPOSAL: 'repo:pub.chive.graph.fieldProposal',
  GRAPH_NODE_PROPOSAL: 'repo:pub.chive.graph.nodeProposal',
  GRAPH_EDGE_PROPOSAL: 'repo:pub.chive.graph.edgeProposal',
  GRAPH_VOTE: 'repo:pub.chive.graph.vote',
  GRAPH_NODE: 'repo:pub.chive.graph.node',
  GRAPH_EDGE: 'repo:pub.chive.graph.edge',

  // Collaboration
  COLLABORATION_INVITE: 'repo:pub.chive.collaboration.invite',
  COLLABORATION_INVITE_ACCEPTANCE: 'repo:pub.chive.collaboration.inviteAcceptance',
} as const;

/**
 * External namespace repo scopes for cross-posting.
 *
 * @remarks
 * These are outside the pub.chive.* namespace. They must always be requested
 * as individual scopes (never inside permission sets, per ATProto spec).
 */
export const EXTERNAL_REPO_SCOPES = {
  // Bluesky
  BLUESKY_POST: 'repo:app.bsky.feed.post',
  BLUESKY_PROFILE: 'repo:app.bsky.actor.profile',

  // Standard (site.standard)
  STANDARD_DOCUMENT: 'repo:site.standard.document',

  // Semble (network.cosmik)
  COSMIK_CARD: 'repo:network.cosmik.card',
  COSMIK_COLLECTION: 'repo:network.cosmik.collection',
  COSMIK_COLLECTION_LINK: 'repo:network.cosmik.collectionLink',
  COSMIK_COLLECTION_LINK_REMOVAL: 'repo:network.cosmik.collectionLinkRemoval',
  COSMIK_CONNECTION: 'repo:network.cosmik.connection',
  COSMIK_FOLLOW: 'repo:network.cosmik.follow',

  // Margin (at.margin)
  MARGIN_ANNOTATION: 'repo:at.margin.annotation',
  MARGIN_BOOKMARK: 'repo:at.margin.bookmark',
  MARGIN_REPLY: 'repo:at.margin.reply',
  MARGIN_LIKE: 'repo:at.margin.like',
} as const;

/** Legacy scope for backward compatibility. */
export const LEGACY_SCOPE = 'transition:generic';

/** ATProto base scope (always required). */
export const ATPROTO_BASE_SCOPE = 'atproto';

/**
 * Permission set hierarchy from least to most permissive.
 *
 * @remarks
 * Each set includes all permissions from sets below it in the hierarchy.
 */
const PERMISSION_HIERARCHY = [
  PERMISSION_SETS.BASIC_READER,
  PERMISSION_SETS.AUTHOR_ACCESS,
  PERMISSION_SETS.REVIEWER_ACCESS,
  PERMISSION_SETS.FULL_ACCESS,
] as const;

/** All external repo scopes as a space-separated string. */
const EXTERNAL_SCOPES_STRING = Object.values(EXTERNAL_REPO_SCOPES).join(' ');

/** All Chive repo scopes as a space-separated string. */
const CHIVE_SCOPES_STRING = Object.values(CHIVE_REPO_SCOPES).join(' ');

/** Read-only subset of Chive repo scopes (none currently - reading is public via AppView). */
const CHIVE_READ_SCOPES_STRING = '';

/**
 * Get the OAuth scope string for a given authorization intent.
 *
 * @remarks
 * Uses individual `repo:pub.chive.*` scopes rather than `include:` permission
 * set references, since the PDS cannot resolve permission set lexicons until
 * they are published. All write intents currently request the full set of
 * Chive collections plus external namespaces for cross-posting.
 *
 * @param intent - The user's intent (browse, submit, review, full)
 * @returns Space-separated scope string including atproto base scope
 */
export function getScopesForIntent(intent: AuthIntent): string {
  const base = ATPROTO_BASE_SCOPE;
  switch (intent) {
    case 'browse':
      return CHIVE_READ_SCOPES_STRING ? `${base} ${CHIVE_READ_SCOPES_STRING}` : base;
    case 'submit':
    case 'review':
    case 'full':
      return `${base} ${CHIVE_SCOPES_STRING} ${EXTERNAL_SCOPES_STRING}`;
  }
}

/**
 * Check if granted scopes satisfy a required scope.
 *
 * @remarks
 * Treats `transition:generic` as granting all pub.chive.* scopes for
 * backward compatibility. Also respects the permission set hierarchy
 * (fullAccess includes reviewerAccess includes authorAccess includes basicReader).
 *
 * @param grantedScopes - Array of scope strings from the OAuth session
 * @param required - The scope string that is required
 * @returns True if the required scope is satisfied
 */
export function hasScope(grantedScopes: readonly string[], required: string): boolean {
  // transition:generic grants everything
  if (grantedScopes.includes(LEGACY_SCOPE)) return true;

  // Exact match
  if (grantedScopes.includes(required)) return true;

  // Permission set hierarchy check
  const requiredIndex = PERMISSION_HIERARCHY.indexOf(
    required as (typeof PERMISSION_HIERARCHY)[number]
  );
  if (requiredIndex >= 0) {
    return grantedScopes.some((s) => {
      const grantedIndex = PERMISSION_HIERARCHY.indexOf(s as (typeof PERMISSION_HIERARCHY)[number]);
      return grantedIndex >= 0 && grantedIndex >= requiredIndex;
    });
  }

  return false;
}
