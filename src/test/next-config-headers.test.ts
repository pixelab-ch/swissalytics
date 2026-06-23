import { describe, it, expect } from 'vitest';
// next.config.js is CommonJS at the repo root; import its default export.
import nextConfig from '../../next.config.js';

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

const headersFn = nextConfig.headers!;

const getRule = (rules: HeaderRule[], source: string) => {
  const rule = rules.find((r) => r.source === source);
  if (!rule) throw new Error(`no header rule for source ${source}`);
  return rule;
};
const valueOf = (rule: HeaderRule, key: string) =>
  rule.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

describe('next.config headers() — Live Preview iframe framing policy', () => {
  it('exposes a headers() function', () => {
    expect(typeof nextConfig.headers).toBe('function');
  });

  it('lets the CMS hub frame /blog (and its locales) via CSP frame-ancestors', async () => {
    const rules = (await headersFn()) as HeaderRule[];
    const blog = getRule(rules, '/blog/:path*');
    expect(valueOf(blog, 'Content-Security-Policy')).toBe(
      "frame-ancestors 'self' https://cms.pixelab.ch"
    );
    // X-Frame-Options must NOT be set on /blog — it would override frame-ancestors
    // and re-block the hub (it cannot whitelist a third-party origin).
    expect(valueOf(blog, 'X-Frame-Options')).toBeUndefined();
  });

  it('keeps every other route locked to same-origin framing', async () => {
    const rules = (await headersFn()) as HeaderRule[];
    const strict = getRule(rules, '/((?!blog).*)');
    expect(valueOf(strict, 'X-Frame-Options')).toBe('SAMEORIGIN');
    expect(valueOf(strict, 'Content-Security-Policy')).toBe("frame-ancestors 'self'");
  });

  it('does not whitelist the hub outside /blog', async () => {
    const rules = (await headersFn()) as HeaderRule[];
    const strict = getRule(rules, '/((?!blog).*)');
    expect(valueOf(strict, 'Content-Security-Policy')).not.toContain('cms.pixelab.ch');
  });

  // The strict source has no `:param`, so Next compiles it to `^<source>$`.
  // Build that regex from the live source string so this stays coupled to config.
  it('strict rule excludes /blog and every locale subpath', async () => {
    const rules = (await headersFn()) as HeaderRule[];
    const strict = getRule(rules, '/((?!blog).*)');
    const re = new RegExp(`^${strict.source}$`);

    // Blog itself + all locale subpaths must NOT match the strict rule (they get
    // the relaxed /blog rule only — no X-Frame-Options, so the hub can frame them).
    for (const p of ['/blog', '/blog/my-slug', '/blog/en', '/blog/en/my-slug', '/blog/de/x']) {
      expect(re.test(p), `${p} should be excluded from strict`).toBe(false);
    }
    // Real non-blog routes keep the framing lock.
    for (const p of ['/', '/about', '/feed.xml', '/compare', '/sitemap.xml']) {
      expect(re.test(p), `${p} should be covered by strict`).toBe(true);
    }
    // Documented LIMITATION: `(?!blog)` is unanchored, so a hypothetical top-level
    // route literally starting with "blog" is also excluded (no live route hits it).
    expect(re.test('/blogroll')).toBe(false);
  });
});
