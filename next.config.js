/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/journal', destination: '/blog', permanent: true },
      { source: '/journal/:slug', destination: '/blog/:slug', permanent: true },
    ];
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  productionBrowserSourceMaps: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    unoptimized: false,
    // Hub-served article media (covers, in-body images) are absolute URLs on the CMS
    // host. Without this, next/image returns 400 and every hub image breaks.
    // COUPLING: this host must match the origin of PAYLOAD_URL (src/lib/blog/hub.ts).
    // If PAYLOAD_URL ever points elsewhere (staging/preview), add that host here too.
    remotePatterns: [{ protocol: 'https', hostname: 'cms.pixelab.ch', pathname: '/api/media/**' }],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

module.exports = nextConfig;
