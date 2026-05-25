import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

/**
 * Stub the SSRF guard so multipage discovery is deterministic (no real DNS).
 * Default: every URL is "safe". Mirrors the eeat test setup — the multipage
 * analyzer fetches the homepage + discovered sub-pages through fetchRealPage,
 * which calls assertSafeUrl first.
 */
vi.mock('@/lib/security/ssrf', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security/ssrf')>(
    '@/lib/security/ssrf',
  );
  return {
    ...actual,
    assertSafeUrl: vi.fn(async (input: string) => ({
      url: new URL(input),
      hostname: new URL(input).hostname,
      resolvedIp: '93.184.216.34',
    })),
  };
});

import { analyzeSchemaOrgMultiPage } from '../schema-org';
import { buildPageContext } from '../page-discovery';
import { assertSafeUrl } from '@/lib/security/ssrf';

const assertSafeUrlMock = vi.mocked(assertSafeUrl);

/**
 * The route now fetches the homepage ONCE (via `buildPageContext`, through the
 * guarded `fetchRealPage`) and threads the resulting `PageContext` into
 * `analyzeSchemaOrgMultiPage`. These tests mirror that: build the context off
 * the same fetch stub, then drive the analyzer with `(url, ctx)`. The homepage
 * is fetched exactly once (by the builder), never again by the analyzer — so
 * the fetch-count assertions still hold.
 */
async function runSchemaMultiPage(url: string) {
  const ctx = await buildPageContext(url);
  return analyzeSchemaOrgMultiPage(url, ctx);
}

/**
 * Schema.org multi-page — link-driven discovery.
 *
 * Pre-fix this probed a hardcoded enigma.swiss-specific URL list
 * (`/blog/automatisation-ia-suisse`, `/portfolio`, `/temoignages`, …) that
 * 404'd on every other site and dragged the average down. These tests pin
 * the new behaviour: pages are discovered from the homepage's REAL links,
 * the score is averaged over pages ACTUALLY found, cross-origin/soft-404
 * pages are skipped, and NO enigma-specific path is assumed.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  assertSafeUrlMock.mockReset();
  assertSafeUrlMock.mockImplementation(async (input: string) => ({
    url: new URL(input),
    hostname: new URL(input).hostname,
    resolvedIp: '93.184.216.34',
  }));
});

const HOMEPAGE = `
  <html><head><title>Acme</title></head><body>
    <nav>
      <a href="/fr/lequipe/">L'équipe</a>
      <a href="/fr/blog/un-article">Blog</a>
      <a href="/fr/contact/">Contact</a>
    </nav>
    <script type="application/ld+json">
      {"@graph":[
        {"@type":"Organization","name":"Acme","url":"https://acme.com","logo":"https://acme.com/l.png","address":"x"},
        {"@type":"WebSite","name":"Acme","url":"https://acme.com"}
      ]}
    </script>
  </body></html>`;

const TEAM_PAGE = `
  <html><head><title>Équipe</title></head><body>
    <script type="application/ld+json">
      {"@type":"Person","name":"Alice","url":"https://acme.com/team","jobTitle":"CEO"}
    </script>
  </body></html>`;

const BLOG_PAGE = `
  <html><head><title>Article</title></head><body>
    <script type="application/ld+json">{"@type":"Article","headline":"Hello"}</script>
    <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
  </body></html>`;

const CONTACT_PAGE = `
  <html><head><title>Contact</title></head><body>
    <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
  </body></html>`;

const SOFT_404 = `<html><head><title>Page introuvable</title></head><body><h1>404</h1></body></html>`;

function fetchStub(routes: Record<string, { status?: number; body?: string }>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [key, res] of Object.entries(routes)) {
      const hit = key === '__home__'
        ? new URL(url).pathname === '/'
        : url.includes(key);
      if (hit) {
        return new Response(res.body ?? '', { status: res.status ?? 200 });
      }
    }
    return new Response('not found', { status: 404 });
  });
}

describe('analyzeSchemaOrgMultiPage — link-driven discovery', () => {
  it('discovers team/blog/contact pages from REAL homepage links (no enigma slugs)', async () => {
    const stub = fetchStub({
      '/fr/lequipe/': { body: TEAM_PAGE },
      '/fr/blog/un-article': { body: BLOG_PAGE },
      '/fr/contact/': { body: CONTACT_PAGE },
      '__home__': { body: HOMEPAGE },
    });
    vi.stubGlobal('fetch', stub);

    const result = await runSchemaMultiPage('https://acme.com');

    // Aggregated across discovered pages.
    expect(result.schemas.organization).toBe(true);
    expect(result.schemas.website).toBe(true);
    expect(result.schemas.author).toBe(true);   // from /fr/lequipe/
    expect(result.schemas.article).toBe(true);  // from /fr/blog/un-article
    expect(result.schemas.breadcrumb).toBe(true);

    // None of enigma's hardcoded paths were ever requested.
    const enigmaPathHit = stub.mock.calls.some(([u]) =>
      /automatisation-ia-suisse|receptionniste-ia|seo-ia-moteurs|\/portfolio|\/temoignages|\/mentions-legales/.test(String(u)),
    );
    expect(enigmaPathHit).toBe(false);
  });

  it('does NOT fetch a fixed 9-page list — only homepage + discovered links', async () => {
    const stub = fetchStub({
      '/fr/lequipe/': { body: TEAM_PAGE },
      '/fr/blog/un-article': { body: BLOG_PAGE },
      '/fr/contact/': { body: CONTACT_PAGE },
      '__home__': { body: HOMEPAGE },
    });
    vi.stubGlobal('fetch', stub);

    await runSchemaMultiPage('https://acme.com');

    // Homepage + exactly the 3 discovered sub-pages = 4 fetches.
    expect(stub.mock.calls.length).toBe(4);
  });

  it('skips soft-404 sub-pages rather than counting them in the average', async () => {
    // Blog link resolves to a soft-404 → must be skipped, not scored as 0.
    const stub = fetchStub({
      '/fr/lequipe/': { body: TEAM_PAGE },
      '/fr/blog/un-article': { status: 200, body: SOFT_404 },
      '/fr/contact/': { body: CONTACT_PAGE },
      '__home__': { body: HOMEPAGE },
    });
    vi.stubGlobal('fetch', stub);

    const result = await runSchemaMultiPage('https://acme.com');
    // The soft-404 blog page contributes no Article schema and isn't averaged in.
    expect(result.schemas.article).toBe(false);
    expect(result.schemas.author).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('does NOT follow a cross-origin link (medium.com blog)', async () => {
    const HOMEPAGE_CROSS = `
      <html><head><title>Acme</title></head><body>
        <a href="https://medium.com/@acme/blog">Blog</a>
        <a href="/fr/lequipe/">Équipe</a>
        <script type="application/ld+json">{"@type":"Organization","name":"Acme","url":"https://acme.com","logo":"x","address":"y"}</script>
      </body></html>`;
    const stub = fetchStub({
      'medium.com': { body: BLOG_PAGE },
      '/fr/lequipe/': { body: TEAM_PAGE },
      '__home__': { body: HOMEPAGE_CROSS },
    });
    vi.stubGlobal('fetch', stub);

    const result = await runSchemaMultiPage('https://acme.com');
    const fetchedMedium = stub.mock.calls.some(([u]) => String(u).includes('medium.com'));
    expect(fetchedMedium).toBe(false);
    // Article never detected because the only blog link was cross-origin.
    expect(result.schemas.article).toBe(false);
  });

  it('falls back to single-page analysis when the homepage is unreachable', async () => {
    const stub = fetchStub({
      // homepage 404s → fetchRealPage returns null → fallback path
    });
    vi.stubGlobal('fetch', stub);

    const result = await runSchemaMultiPage('https://down.com');
    // Falls back to analyzeSchemaOrg(baseUrl) which (on 404) returns the
    // simulated shape — we just assert it doesn't throw and returns a result.
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('schemas');
  });

  it('scores a link-less homepage on its own schemas only (no penalty for missing sub-pages)', async () => {
    const HOMEPAGE_RICH_NO_LINKS = `
      <html><head><title>Solo</title></head><body>
        <script type="application/ld+json">
          {"@graph":[
            {"@type":"Organization","name":"Solo","url":"https://solo.com","logo":"https://solo.com/l.png","address":"x"},
            {"@type":"WebSite","name":"Solo","url":"https://solo.com"},
            {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Q1?","acceptedAnswer":{"@type":"Answer","text":"A1"}},{"@type":"Question","name":"Q2?","acceptedAnswer":{"@type":"Answer","text":"A2"}}]}
          ]}
        </script>
      </body></html>`;
    const stub = fetchStub({ '__home__': { body: HOMEPAGE_RICH_NO_LINKS } });
    vi.stubGlobal('fetch', stub);

    const result = await runSchemaMultiPage('https://solo.com');
    // Only the homepage was fetched (no nav links to discover).
    expect(stub.mock.calls.length).toBe(1);
    expect(result.schemas.organization).toBe(true);
    expect(result.schemas.website).toBe(true);
    expect(result.schemas.faqPage).toBe(true);
    // Score reflects the homepage's own coverage, not a 9-page-404 average.
    expect(result.score).toBeGreaterThan(0);
  });

  // Keyword-consolidation regression (Refactor B): schema-org's `team` group
  // now reuses the shared TEAM_KEYWORDS, which include `notre-equipe`. The
  // pre-consolidation schema team group LACKED `notre-equipe`, so a homepage
  // linking only to /notre-equipe would have missed the Person/author schema.
  it('discovers a /notre-equipe team page (was missing from schema team keywords pre-consolidation)', async () => {
    const HOMEPAGE_NOTRE_EQUIPE = `
      <html><head><title>Acme</title></head><body>
        <nav><a href="/notre-equipe">Notre équipe</a></nav>
        <script type="application/ld+json">{"@type":"Organization","name":"Acme","url":"https://acme.com","logo":"x","address":"y"}</script>
      </body></html>`;
    const stub = fetchStub({
      '/notre-equipe': { body: TEAM_PAGE },
      '__home__': { body: HOMEPAGE_NOTRE_EQUIPE },
    });
    vi.stubGlobal('fetch', stub);

    const result = await runSchemaMultiPage('https://acme.com');
    // Author/Person schema is picked up from the discovered /notre-equipe page.
    expect(result.schemas.author).toBe(true);
    const fetchedTeam = stub.mock.calls.some(([u]) => String(u).includes('/notre-equipe'));
    expect(fetchedTeam).toBe(true);
  });
});
