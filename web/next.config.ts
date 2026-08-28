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
    // here. Everything else in this policy is enforceable today and closes the
    // injection paths that do not depend on running script — an injected
    // `<base>`, a retargeted form post, an embedded object, or the page being
    // framed by somebody else's site.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const isDev = process.env.NODE_ENV !== 'production';

    const csp = [
      "default-src 'self'",
      // React Refresh evaluates code in development and nowhere else.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${apiUrl}${isDev ? ' ws: wss:' : ''}`,
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
