import { NextRequest, NextResponse } from 'next/server';

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
    redirect_uris: [`${baseUrl}/oauth/callback`],

    // Token endpoint authentication method
    // "none" means public client (no client secret)
    token_endpoint_auth_method: 'none',

    // Grant types this client uses
    grant_types: ['authorization_code', 'refresh_token'],

    // Response types this client uses
    response_types: ['code'],

    // Scopes this client requests
    scope: 'atproto transition:generic',

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
      // Cache for 1 hour
      'Cache-Control': 'public, max-age=3600',
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
