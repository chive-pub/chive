import { NextRequest, NextResponse } from 'next/server';

/**
 * Whether client metadata should declare `include:pub.chive.auth.*`
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
  'include:pub.chive.auth.basicReader',
  'include:pub.chive.auth.authorAccess',
  'include:pub.chive.auth.reviewerAccess',
  'include:pub.chive.auth.fullAccess',
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

const EXTERNAL_REPO_SCOPES = [
  'repo:app.bsky.feed.post',
  'repo:app.bsky.actor.profile',
  'repo:site.standard.document',
  'repo:network.cosmik.card',
  'repo:network.cosmik.collection',
  'repo:network.cosmik.collectionLink',
  'repo:network.cosmik.collectionLinkRemoval',
  'repo:network.cosmik.connection',
  'repo:network.cosmik.follow',
  'repo:at.margin.annotation',
  'repo:at.margin.bookmark',
  'repo:at.margin.reply',
  'repo:at.margin.like',
];

function buildScope(): string {
  const chive = USE_PERMISSION_SETS ? PERMISSION_SET_SCOPES : CHIVE_REPO_SCOPES;
  return ['atproto', ...chive, ...EXTERNAL_REPO_SCOPES, 'blob:*/*'].join(' ');
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

    // Logo URL (optional, but nice to have)
    logo_uri: `${baseUrl}/logo.png`,

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
