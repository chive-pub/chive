import { NextRequest, NextResponse } from 'next/server';

/**
 * Whether client metadata should declare `include:pub.chive.* permission sets`
 * permission-set references instead of individual `repo:pub.chive.*`
 * scopes.
 *
 * @remarks
 * Safe to set `true` only when DNS TXT records at `_lexicon.<sub>.chive.pub`
 * resolve to `did=did:web:chive.pub`. Otherwise bsky.social will reject the
 * metadata when it fails to resolve the permission-set NSID.
 */
const USE_PERMISSION_SETS = process.env.NEXT_PUBLIC_USE_PERMISSION_SETS === 'true';

const PERMISSION_SET_SCOPES = [
  'include:pub.chive.basicReader',
  'include:pub.chive.authorAccess',
  'include:pub.chive.reviewerAccess',
  'include:pub.chive.fullAccess',
];

const CHIVE_REPO_SCOPES = [
  'repo:pub.chive.eprint.submission',
  'repo:pub.chive.eprint.version',
  'repo:pub.chive.eprint.userTag',
  'repo:pub.chive.eprint.citation',
  'repo:pub.chive.eprint.relatedWork',
  'repo:pub.chive.eprint.changelog',
  'repo:pub.chive.actor.profile',
  'repo:pub.chive.actor.profileConfig',
  'repo:pub.chive.actor.mute',
  'repo:pub.chive.discovery.settings',
  'repo:pub.chive.review.comment',
  'repo:pub.chive.review.endorsement',
  'repo:pub.chive.annotation.comment',
  'repo:pub.chive.annotation.entityLink',
  'repo:pub.chive.graph.fieldProposal',
  'repo:pub.chive.graph.nodeProposal',
  'repo:pub.chive.graph.edgeProposal',
  'repo:pub.chive.graph.vote',
  'repo:pub.chive.graph.node',
  'repo:pub.chive.graph.edge',
  'repo:pub.chive.collaboration.invite',
  'repo:pub.chive.collaboration.inviteAcceptance',
];

// External-namespace scopes for cooperating apps.
//
// Hybrid layout: prefer `include:<nsid>` permission sets where they cover
// everything Chive writes, fall back to `repo:` scopes only for gaps and for
// apps that don't publish a permission set at all.
//
// - Margin: at.margin.authFull covers all of note/reply/like/collection (we
//   migrated the dual-write to use at.margin.note for everything).
// - Standard.site: site.standard.authFull covers document + publication +
//   recommend + subscription. Chive only writes document; permission set
//   is sufficient.
// - Semble: network.cosmik.authFull covers card/collection/collectionLink/
//   collectionLinkRemoval but OMITS connection and follow which Chive
//   dual-writes. Supplement with repo scopes until Semble expands authFull.
// - Bluesky: no permission set published; use repo scopes.
const EXTERNAL_SCOPES = [
  'include:at.margin.authFull',
  'include:site.standard.authFull',
  'include:network.cosmik.authFull',
  'repo:network.cosmik.connection',
  'repo:network.cosmik.follow',
  'repo:app.bsky.feed.post',
  'repo:app.bsky.actor.profile',
];

function buildScope(): string {
  const chive = USE_PERMISSION_SETS ? PERMISSION_SET_SCOPES : CHIVE_REPO_SCOPES;
  return ['atproto', ...chive, ...EXTERNAL_SCOPES, 'blob:*/*'].join(' ');
}

/**
 * OAuth client metadata endpoint.
 *
 * @remarks
 * ATProto OAuth requires the client_id to be a URL that returns
 * a JSON document with client metadata. This endpoint provides
 * that metadata for Chive's OAuth client.
 *
 * @see {@link https://atproto.com/specs/oauth | ATProto OAuth Specification}
 */
export async function GET(request: NextRequest) {
  // Get the base URL from the request or environment
  const baseUrl = getBaseUrl(request);

  const metadata = {
    // Client identifier (this URL itself)
    client_id: `${baseUrl}/oauth/client-metadata.json`,

    // Human-readable client name
    client_name: 'Chive | Decentralized Eprint Service',

    // Client homepage
    client_uri: baseUrl,

    // Logo URL. Rendered in the PDS consent screen header (per
    // @atproto/oauth-provider-ui's ClientImage component), not beside
    // individual scope cards. Must be an asset that actually exists.
    logo_uri: `${baseUrl}/chive-logo.svg`,

    // Terms of service URL
    tos_uri: `${baseUrl}/about/terms`,

    // Privacy policy URL
    policy_uri: `${baseUrl}/about/privacy`,

    // Allowed redirect URIs
    // Includes main callback and paper-specific callback for popup flow
    redirect_uris: [`${baseUrl}/oauth/callback`, `${baseUrl}/oauth/paper-callback`],

    // Token endpoint authentication method
    // "none" means public client (no client secret)
    token_endpoint_auth_method: 'none',

    // Grant types this client uses
    grant_types: ['authorization_code', 'refresh_token'],

    // Response types this client uses
    response_types: ['code'],

    // Maximum set of scopes this client may request. Individual login
    // flows request subsets via getScopesForIntent().
    scope: buildScope(),

    // DPoP (Demonstrating Proof of Possession) - required by ATProto
    dpop_bound_access_tokens: true,

    // Application type
    application_type: 'web',
  };

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      // Allow CORS for authorization servers to fetch this
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      // Short cache to allow quick metadata updates
      'Cache-Control': 'public, max-age=60',
    },
  });
}

/**
 * Handle CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Get the base URL for OAuth endpoints.
 *
 * Priority:
 * 1. NEXT_PUBLIC_OAUTH_BASE_URL environment variable (for ngrok/tunnel)
 * 2. X-Forwarded-Host header (for reverse proxy)
 * 3. Host header
 * 4. Fallback to chive.pub
 */
function getBaseUrl(request: NextRequest): string {
  // Check for explicit override (for ngrok/tunnel development)
  if (process.env.NEXT_PUBLIC_OAUTH_BASE_URL) {
    return process.env.NEXT_PUBLIC_OAUTH_BASE_URL;
  }

  // Try to get from request headers
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';

  if (forwardedHost) {
    return `${protocol}://${forwardedHost}`;
  }

  if (host) {
    // For localhost, use http
    const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : protocol;
    return `${proto}://${host}`;
  }

  // Fallback for production
  return 'https://chive.pub';
}
