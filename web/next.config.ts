import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,

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
        hostname: 'cdn.chive.pub',
      },
      {
        protocol: 'https',
        hostname: 'avatar.vercel.sh',
      },
    ],
  },

  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/xrpc/:path*',
        destination: `${apiUrl}/xrpc/:path*`,
      },
    ];
  },
};

export default nextConfig;
