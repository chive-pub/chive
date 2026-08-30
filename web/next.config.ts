import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  allowedDevHosts: ['chive.ngrok.app'],

  // typedRoutes: Disabled until route pages are created
  // typedRoutes: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.bsky.social',
      },
      {
        protocol: 'https',
        hostname: 'cdn.bsky.app',
      },
      {
        protocol: 'https',
        hostname: 'cdn.chive.pub',
      },
      {
        protocol: 'https',
        hostname: 'avatar.vercel.sh',
      },
    ],
  },

  async headers() {
    // The frontend shipped with no Content-Security-Policy at all, which is
    // what let the stored-XSS hole fixed in 0.8.0 reach as far as it did.
    //
    // `script-src` still carries 'unsafe-inline': Next.js inlines its own
    // bootstrap and hydration payloads, and removing it requires per-request
    // nonces threaded through the app. That is worth doing and is not done
    // here. The rest closes the injection paths that do not depend on running
    // script — an injected `<base>`, a retargeted form post, an embedded
    // object, or the page being framed by somebody else's site.
    //
    // `connect-src` is deliberately `https:` rather than a host list, and this
    // is a property of the protocol rather than a shortcut. An ATProto client
    // running in the browser talks to hosts it discovers at runtime and cannot
    // know in advance:
    //
    //   - the user's own PDS, whose hostname comes out of their DID document.
    //     Every record this app writes — eprints, reviews, mutes, Layers data
    //     links — is a direct browser-to-PDS `com.atproto.repo.*` call. The set
    //     of PDS hosts is open by design; anyone may run one.
    //   - handle resolution, which reads DNS over `https://dns.google` and
    //     falls back to the public AppView.
    //   - `plc.directory`, for the DID document that names the PDS.
    //   - the OAuth authorization server, which is the user's PDS again.
    //
    // A previous version of this policy allowed only `'self'` and the Chive
    // API. That silently blocked all four, so sign-in failed at handle
    // resolution and every record write would have been refused. CSP has no
    // way to express "any host this document later learns about", so a host
    // list cannot be made correct here; narrowing it again would break sign-in
    // again. What `https:` still buys is real: no plaintext-HTTP exfiltration
    // channel, and no non-HTTP scheme. The controls that actually contain XSS
    // in this policy are `script-src`, `object-src`, `base-uri` and
    // `form-action`, and they are unaffected.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const isDev = process.env.NODE_ENV !== 'production';

    const csp = [
      "default-src 'self'",
      // React Refresh evaluates code in development and nowhere else.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${apiUrl} https: wss:${isDev ? ' ws: http://localhost:*' : ''}`,
      // PDF.js runs its renderer in a blob worker.
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: '/apply', destination: '/', permanent: true },
      { source: '/pending', destination: '/', permanent: true },
    ];
  },

  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/xrpc/:path*',
        destination: `${apiUrl}/xrpc/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
