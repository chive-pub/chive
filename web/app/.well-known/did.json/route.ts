import { NextRequest, NextResponse } from 'next/server';

/**
 * did:web document for Chive's lexicon-hosting DID.
 *
 * @remarks
 * Resolvers reach this endpoint after transforming `did:web:chive.pub`
 * into `https://chive.pub/.well-known/did.json`. Declares Chive's API
 * service as the PDS endpoint so `com.atproto.repo.getRecord` can be
 * used to fetch lexicon schemas for NSIDs in the `pub.chive.*` namespace.
 *
 * The DID responds dynamically to whichever host it's served from, so the
 * same code works on production (`chive.pub`) and staging
 * (`staging.chive.pub`). DNS TXT records at `_lexicon.<authority>` must
 * point to the matching DID for resolution to succeed.
 */
export async function GET(request: NextRequest) {
  const host = getHost(request);
  const did = `did:web:${host}`;
  const serviceEndpoint = `https://${host}`;

  const doc = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    alsoKnownAs: [`at://${host}`],
    service: [
      {
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
        serviceEndpoint,
      },
      // Service entry referenced by `<did>#chive_appview` audiences in OAuth
      // scopes and service-auth JWTs. Atproto audiences require a fragment;
      // we use this one consistently across the frontend, backend, and
      // published permission-set lexicons.
      {
        id: '#chive_appview',
        type: 'ChiveAppView',
        serviceEndpoint,
      },
    ],
  };

  return NextResponse.json(doc, {
    headers: {
      'Content-Type': 'application/did+json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

function getHost(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_OAUTH_BASE_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_OAUTH_BASE_URL).host;
    } catch {
      /* fall through */
    }
  }
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) return forwardedHost;
  const host = request.headers.get('host');
  if (host) return host;
  return 'chive.pub';
}
