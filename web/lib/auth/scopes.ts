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
/**
 * Chive's service DID. Each `include:<nsid>` is suffixed with
 * `?aud=<CHIVE_SERVICE_DID>` so the rpc permissions inside the permission
 * set (all of which carry `inheritAud: true`) inherit this audience.
 * Without it, issued tokens carry rpc scopes with audience `undefined`
 * and the PDS rejects service-auth JWT requests where the JWT specifies
 * `aud=did:web:<host>`.
 */
const CHIVE_SERVICE_DID = process.env.NEXT_PUBLIC_CHIVE_SERVICE_DID ?? 'did:web:chive.pub';

export const PERMISSION_SETS = {
  BASIC_READER: `include:pub.chive.basicReader?aud=${CHIVE_SERVICE_DID}`,
  AUTHOR_ACCESS: `include:pub.chive.authorAccess?aud=${CHIVE_SERVICE_DID}`,
  REVIEWER_ACCESS: `include:pub.chive.reviewerAccess?aud=${CHIVE_SERVICE_DID}`,
  FULL_ACCESS: `include:pub.chive.fullAccess?aud=${CHIVE_SERVICE_DID}`,
} as const;

/**
 * Individual repo scopes for pub.chive.* collections.
 *
 * @remarks
 * Used directly in OAuth scope strings until we can publish permission set
 * lexicons that the PDS can resolve. Once `include:pub.chive.* permission sets` works,
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
 * External namespace scopes for cross-posting and cooperating apps.
 *
 * @remarks
 * Each cooperating app (Semble, Margin, site.standard) publishes its own
 * canonical `permission-set` lexicon, which we prefer over enumerating
 * individual collections — the consent screen renders one named entry per
 * app, with that publisher's own title and detail copy.
 *
 * `app.bsky.*` does not currently publish a single permission set covering
 * post + profile, so those remain individual repo scopes.
 */
export const EXTERNAL_REPO_SCOPES = {
  // Bluesky -- no permission set published
  BLUESKY_POST: 'repo:app.bsky.feed.post',
  BLUESKY_PROFILE: 'repo:app.bsky.actor.profile',

  // Standard.site -- authFull covers document, publication, graph.recommend,
  // graph.subscription. Chive only writes document, so this is sufficient.
  STANDARD_FULL: 'include:site.standard.authFull',

  // Semble -- authFull covers card, collection, collectionLink,
  // collectionLinkRemoval but is missing connection + follow that Chive
  // writes. Hybrid: include + supplementary repo scopes for the gaps.
  COSMIK_FULL: 'include:network.cosmik.authFull',
  COSMIK_CONNECTION: 'repo:network.cosmik.connection',
  COSMIK_FOLLOW: 'repo:network.cosmik.follow',

  // Margin -- authFull covers note/reply/like/collection/collectionItem/
  // profile/preferences/apikey. Chive's notes write at.margin.note (W3C
  // web annotations) for both reviews and bookmarks via the `motivation`
  // field; replies go to at.margin.reply, likes to at.margin.like.
  MARGIN_FULL: 'include:at.margin.authFull',
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
 * Whether to emit `include:pub.chive.* permission sets` permission-set references
 * instead of individual `repo:pub.chive.*` scopes.
 *
 * @remarks
 * Controlled by the `NEXT_PUBLIC_USE_PERMISSION_SETS` build-time env var.
 * Safe to flip to `true` only after both conditions hold:
 *
 * 1. Chive is serving lexicon records for `pub.chive.* permission sets` NSIDs (the
 *    `com.atproto.repo.getRecord` endpoints landed in #74 — already live).
 * 2. A DNS TXT record exists at `_lexicon.auth.chive.pub` pointing at
 *    `did=did:web:chive.pub`, so resolving services (bsky.social) can
 *    find the DID that owns the `pub.chive.* permission sets` namespace.
 *
 * Requesting `include:` scopes without (2) causes the OAuth PAR request
 * to fail with `invalid_scope / Could not resolve Lexicon for NSID`.
 */
const USE_PERMISSION_SETS = process.env.NEXT_PUBLIC_USE_PERMISSION_SETS === 'true';

/**
 * Map an auth intent to the matching permission-set reference.
 */
function permissionSetForIntent(intent: AuthIntent): string {
  switch (intent) {
    case 'browse':
      return PERMISSION_SETS.BASIC_READER;
    case 'submit':
      return PERMISSION_SETS.AUTHOR_ACCESS;
    case 'review':
      return PERMISSION_SETS.REVIEWER_ACCESS;
    case 'full':
      return PERMISSION_SETS.FULL_ACCESS;
  }
}

/**
 * Get the OAuth scope string for a given authorization intent.
 *
 * @remarks
 * By default emits individual `repo:pub.chive.*` scopes, because PDSes
 * can't yet resolve our permission-set lexicons. Set
 * `NEXT_PUBLIC_USE_PERMISSION_SETS=true` at build time to switch to
 * `include:pub.chive.* permission sets` references once DNS TXT records for
 * lexicon resolution are in place.
 *
 * @param intent - The user's intent (browse, submit, review, full)
 * @returns Space-separated scope string including atproto base scope
 */
// `rpc:*?aud=<chive-did>` grants all RPC calls scoped to Chive's API DID.
// Required on the legacy `repo:`-only path so the frontend's
// `getServiceAuthToken` calls (ORCID, admin, claiming, profile config)
// can mint a service-auth JWT. The forbidden form is `rpc:*?aud=*`.
const RPC_WILDCARD_SCOPE = `rpc:*?aud=${CHIVE_SERVICE_DID}`;

export function getScopesForIntent(intent: AuthIntent): string {
  const base = ATPROTO_BASE_SCOPE;
  if (USE_PERMISSION_SETS) {
    const permSet = permissionSetForIntent(intent);
    if (intent === 'browse') return `${base} ${permSet}`;
    return `${base} ${permSet} ${EXTERNAL_SCOPES_STRING}`;
  }
  switch (intent) {
    case 'browse':
      return CHIVE_READ_SCOPES_STRING
        ? `${base} ${CHIVE_READ_SCOPES_STRING} ${RPC_WILDCARD_SCOPE}`
        : `${base} ${RPC_WILDCARD_SCOPE}`;
    case 'submit':
    case 'review':
    case 'full':
      return `${base} ${CHIVE_SCOPES_STRING} ${RPC_WILDCARD_SCOPE} ${EXTERNAL_SCOPES_STRING}`;
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
