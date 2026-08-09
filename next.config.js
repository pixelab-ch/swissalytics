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
  // Framing policy — owned by the app, not the host (see docs/preview-iframe-fix.md).
  // The CMS hub (cms.pixelab.ch) loads the Live Preview in an iframe pointed at
  // /blog/<slug>. X-Frame-Options can only express SAMEORIGIN/DENY — it cannot
  // allow a specific third-party origin — so the hub is whitelisted via the modern
  // CSP `frame-ancestors`, on /blog only. Everything else keeps the strict policy.
  //
  // HOST (resolved 2026-08-09): the global `add_header X-Frame-Options SAMEORIGIN`
  // is gone from the nginx config, so framing is now decided here per-route and
  // nothing overrides it. nginx still posts nosniff, Referrer-Policy and
  // Permissions-Policy globally, which is intended.
  //
  // Verified live: `/` and `/methode` return SAMEORIGIN + frame-ancestors 'self';
  // `/blog` returns frame-ancestors 'self' https://cms.pixelab.ch and no
  // X-Frame-Options. Re-adding a global X-Frame-Options on the host would break
  // the hub Live Preview again — the browser keeps the most restrictive header.
  async headers() {
    const FRONT = "'self'";
    const HUB = 'https://cms.pixelab.ch';
    return [
      // Blog (all locales live under /blog: /blog, /blog/en, /blog/de, /blog/it).
      // Framing allowed from self + the hub; no X-Frame-Options here on purpose.
      {
        source: '/blog/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: `frame-ancestors ${FRONT} ${HUB}` },
        ],
      },
      // Everything except /blog: framing locked to same-origin (preserves the
      // current SAMEORIGIN behavior; CSP frame-ancestors is the modern equivalent
      // for browsers that ignore X-Frame-Options).
      // LIMITATION: Next's `source` DSL can't anchor the exclusion on a segment
      // boundary (a `$` in the lookahead fails to compile), so `(?!blog)` also
      // excludes any hypothetical top-level route literally starting with "blog"
      // (e.g. /blogroll) — it would ship without these framing headers. None exist
      // today; if one is ever added, give it its own strict rule explicitly.
      // INVARIANT: blog locales must stay UNDER /blog (/blog/en, /blog/de, /blog/it).
      // If a locale ever moves to a prefix form (/en/blog), add its source to the
      // relaxed rule above or preview breaks on that locale.
      // CSP NOTE: this is the only Content-Security-Policy emitted. Any future CSP
      // must MERGE frame-ancestors into a single header — a second CSP header would
      // be enforced as an intersection and can re-block the hub iframe.
      {
        source: '/((?!blog).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: `frame-ancestors ${FRONT}` },
        ],
      },
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
