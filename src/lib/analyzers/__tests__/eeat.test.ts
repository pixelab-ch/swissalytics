import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

/**
 * Stub the SSRF guard so the integration tests are deterministic (no real
 * DNS) AND so we can assert the same-origin / private-IP rejection paths.
 * Default: every URL is "safe". Individual tests override `assertSafeUrl`
 * to throw an `SsrfError` for a specific host (e.g. metadata IP) and verify
 * `fetch` is never reached for it.
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

import { analyzeEEAT } from '../eeat';
import { assertSafeUrl, SsrfError } from '@/lib/security/ssrf';

const assertSafeUrlMock = vi.mocked(assertSafeUrl);

/**
 * GEO E-E-A-T analyzer — link-driven, locale-aware content analysis.
 *
 * Pre-fix the analyzer GUESSED hardcoded URLs (`/team`, `/about`, …) and
 * trusted `response.ok` blindly. On real sites whose pages live under
 * locale-prefixed / contracted paths (enigma.swiss → `/fr/lequipe/`) and
 * which serve HTTP-200 soft-404s, detection failed and the 5s budget blew,
 * dropping the whole tile to the all-missing fallback → bogus "create a
 * team page" reco.
 *
 * These tests pin the new behaviour: links are read from the submitted
 * page's real HTML, matched against locale-aware / accent-tolerant
 * keywords on PATH SEGMENTS and anchor text, the best candidate is fetched
 * once, and soft-404s are rejected.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

/** Default safe-URL behaviour, re-established after `restoreAllMocks`. */
beforeEach(() => {
  assertSafeUrlMock.mockReset();
  assertSafeUrlMock.mockImplementation(async (input: string) => ({
    url: new URL(input),
    hostname: new URL(input).hostname,
    resolvedIp: '93.184.216.34',
  }));
});

/* ------------------------------------------------------------------ *
 * Integration-style: drive analyzeEEAT with a controlled fetch stub
 * that mimics a real site's responses (homepage links + target pages).
 * ------------------------------------------------------------------ */

const HOMEPAGE_ENIGMA = `
  <html><head><title>Enigma</title></head><body>
    <nav>
      <a href="/fr/lequipe/">L'équipe</a>
      <a href="/fr/contact/">Contact</a>
      <a href="/fr/mentions-legales/">Mentions légales</a>
    </nav>
  </body></html>`;

const TEAM_PAGE = `
  <html><head><title>Notre équipe — Enigma</title></head><body>
    <h1>L'équipe</h1>
    <script type="application/ld+json">
      {"@graph":[
        {"@type":"Person","name":"Alice"},
        {"@type":"Person","name":"Bob"},
        {"@type":"Person","name":"Carol"}
      ]}
    </script>
    <div class="team-member"><p>Alice est experte en data science et fondatrice de la société, forte de plus de dix années d'expérience dans l'analyse de données et le conseil stratégique.</p></div>
    <div class="team-member"><p>Bob est directeur technique (CTO) et spécialiste reconnu de l'ingénierie logicielle distribuée, des architectures cloud et de la fiabilité des systèmes à grande échelle.</p></div>
    <div class="team-member"><p>Carol est directrice marketing (CMO) et experte en stratégie de croissance B2B, avec un parcours solide en acquisition, branding et développement commercial international.</p></div>
  </body></html>`;

const CONTACT_PAGE = `
  <html><head><title>Contact — Enigma</title></head><body>
    <a href="mailto:hello@enigma.swiss">hello@enigma.swiss</a>
    <a href="tel:+41215551234">+41 21 555 12 34</a>
    <p>Adresse : Rue du Lac 1, 1000 Lausanne</p>
  </body></html>`;

const SOFT_404 = `<html><head><title>Page introuvable</title></head><body><h1>404</h1></body></html>`;

/** Dedicated reviews page with Review JSON-LD. */
const TESTIMONIALS_PAGE = `
  <html><head><title>Témoignages — Enigma</title></head><body>
    <h1>Avis clients</h1>
    <script type="application/ld+json">
      {"@graph":[
        {"@type":"Review","author":{"@type":"Person","name":"Alice"},"reviewBody":"Excellent"},
        {"@type":"Review","author":{"@type":"Person","name":"Bob"},"reviewBody":"Top"}
      ]}
    </script>
  </body></html>`;

/**
 * Build a fetch stub. Routes keyed by a path-bearing substring (e.g.
 * `/fr/lequipe/`) match by `includes`. The special `__home__` key matches
 * ONLY the bare-origin homepage URL (so sub-paths don't accidentally hit it).
 */
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
    // default: 404 not-found (real HTTP 404)
    return new Response('not found', { status: 404 });
  });
}

describe('analyzeEEAT — link-driven detection (enigma case)', () => {
  beforeEach(() => {
    delete process.env.MOZ_API_KEY;
  });

  it('finds the team page from the /fr/lequipe/ homepage link', async () => {
    vi.stubGlobal('fetch', fetchStub({
      '/fr/lequipe/': { body: TEAM_PAGE },
      '/fr/contact/': { body: CONTACT_PAGE },
      '/fr/mentions-legales/': { body: '<title>Mentions légales</title>' },
      // homepage (matches origin root) — must come last in includes order; use exact-ish
      '__home__': { body: HOMEPAGE_ENIGMA },
    }));

    const result = await analyzeEEAT('https://enigma.swiss/');
    expect(result.signals.teamPage.found).toBe(true);
    expect(result.signals.teamPage.authorsCount).toBeGreaterThanOrEqual(3);
    expect(result.signals.teamPage.quality).toBe('high');
    // The bogus "create a team page" reco must be gone.
    expect(result.recommendations.join(' ')).not.toMatch(/Créer page équipe/i);
  });

  it('detects contact + legal from their homepage links', async () => {
    vi.stubGlobal('fetch', fetchStub({
      '/fr/lequipe/': { body: TEAM_PAGE },
      '/fr/contact/': { body: CONTACT_PAGE },
      '/fr/mentions-legales/': { body: '<title>Mentions légales — Enigma</title><p>Mentions</p>' },
      '__home__': { body: HOMEPAGE_ENIGMA },
    }));

    const result = await analyzeEEAT('https://enigma.swiss/');
    expect(result.signals.contactPage.found).toBe(true);
    expect(result.signals.contactPage.hasEmail).toBe(true);
    expect(result.signals.contactPage.hasPhone).toBe(true);
    expect(result.signals.contactPage.hasAddress).toBe(true);
    expect(result.signals.legalMentions).toBe(true);
  });

  it('rejects a soft-404 (HTTP 200 "Page introuvable") as NOT found', async () => {
    vi.stubGlobal('fetch', fetchStub({
      // homepage links to a "team" page that is actually a soft-404
      '/fr/lequipe/': { status: 200, body: SOFT_404 },
      '__home__': { body: HOMEPAGE_ENIGMA },
    }));

    const result = await analyzeEEAT('https://enigma.swiss/');
    expect(result.signals.teamPage.found).toBe(false);
  });

  it('detects author bios from the homepage HTML without refetching it', async () => {
    const HOMEPAGE_WITH_AUTHORS = `
      <html><head><title>Blog</title></head><body>
        <a href="/team">Team</a>
        <script type="application/ld+json">{"@type":"Person","name":"Jane"}</script>
        <div class="author-bio">Jane Doe</div>
      </body></html>`;
    const stub = fetchStub({
      '/team': { body: TEAM_PAGE },
      '__home__': { body: HOMEPAGE_WITH_AUTHORS },
    });
    vi.stubGlobal('fetch', stub);

    const result = await analyzeEEAT('https://example.com/');
    expect(result.signals.authorBios.found).toBe(true);
    expect(result.signals.authorBios.count).toBeGreaterThan(0);
  });

  it('falls back to a minimal hardcoded probe when no link matches', async () => {
    const HOMEPAGE_NO_LINKS = '<html><head><title>X</title></head><body><a href="/products">Products</a></body></html>';
    vi.stubGlobal('fetch', fetchStub({
      // no team link on homepage, but /team exists as a real page
      '/team': { body: TEAM_PAGE },
      '__home__': { body: HOMEPAGE_NO_LINKS },
    }));

    const result = await analyzeEEAT('https://nolinks.com/');
    expect(result.signals.teamPage.found).toBe(true);
  });

  it('reports team NOT found when neither links nor probe URLs resolve', async () => {
    vi.stubGlobal('fetch', fetchStub({
      '__home__': { body: '<html><head><title>X</title></head><body><a href="/products">P</a></body></html>' },
      // everything else → real 404
    }));

    const result = await analyzeEEAT('https://empty.com/');
    expect(result.signals.teamPage.found).toBe(false);
    expect(result.recommendations.join(' ')).toMatch(/page équipe/i);
  });

  it('still finds the same-origin team page (happy path) — /fr/lequipe/', async () => {
    vi.stubGlobal('fetch', fetchStub({
      '/fr/lequipe/': { body: TEAM_PAGE },
      '__home__': { body: HOMEPAGE_ENIGMA },
    }));

    const result = await analyzeEEAT('https://enigma.swiss/');
    expect(result.signals.teamPage.found).toBe(true);
    expect(result.signals.teamPage.quality).toBe('high');
  });
});

/* ------------------------------------------------------------------ *
 * Testimonials — link-driven discovery + on-homepage detection.
 * ------------------------------------------------------------------ */
describe('analyzeEEAT — testimonials (link-driven)', () => {
  beforeEach(() => {
    delete process.env.MOZ_API_KEY;
  });

  it('discovers the reviews page from a locale-prefixed /fr/temoignages/ link', async () => {
    const HOMEPAGE = `
      <html><head><title>Enigma</title></head><body>
        <nav><a href="/fr/temoignages/">Témoignages</a></nav>
      </body></html>`;
    vi.stubGlobal('fetch', fetchStub({
      '/fr/temoignages/': { body: TESTIMONIALS_PAGE },
      '__home__': { body: HOMEPAGE },
    }));

    const result = await analyzeEEAT('https://enigma.swiss/');
    expect(result.signals.testimonials.found).toBe(true);
    expect(result.signals.testimonials.count).toBe(2);
    expect(result.signals.testimonials.hasSchema).toBe(true);
  });

  it('discovers a German /de/referenzen and an Italian /it/recensioni link', async () => {
    const HOMEPAGE_DE = `<html><head><title>X</title></head><body><a href="/de/referenzen">Referenzen</a></body></html>`;
    vi.stubGlobal('fetch', fetchStub({
      '/de/referenzen': { body: TESTIMONIALS_PAGE },
      '__home__': { body: HOMEPAGE_DE },
    }));
    let result = await analyzeEEAT('https://site.de/');
    expect(result.signals.testimonials.found).toBe(true);

    const HOMEPAGE_IT = `<html><head><title>X</title></head><body><a href="/it/recensioni">Recensioni</a></body></html>`;
    vi.stubGlobal('fetch', fetchStub({
      '/it/recensioni': { body: TESTIMONIALS_PAGE },
      '__home__': { body: HOMEPAGE_IT },
    }));
    result = await analyzeEEAT('https://site.it/');
    expect(result.signals.testimonials.found).toBe(true);
  });

  it('detects testimonials embedded on the homepage WITHOUT refetching it', async () => {
    const HOMEPAGE_WITH_REVIEWS = `
      <html><head><title>Acme</title></head><body>
        <a href="/products">Products</a>
        <div class="testimonial">Great service — Alice</div>
        <div class="testimonial">Loved it — Bob</div>
        <div class="review">5/5 — Carol</div>
      </body></html>`;
    const stub = fetchStub({ '__home__': { body: HOMEPAGE_WITH_REVIEWS } });
    vi.stubGlobal('fetch', stub);

    const result = await analyzeEEAT('https://acme.com/');
    expect(result.signals.testimonials.found).toBe(true);
    expect(result.signals.testimonials.count).toBe(3);
    // Homepage fetched exactly once → testimonials reused it, never refetched it.
    const homeFetches = stub.mock.calls.filter(([u]) => new URL(String(u)).pathname === '/');
    expect(homeFetches.length).toBe(1);
    // And no testimonial-keyword sub-page was probed (reviews were on the home).
    const reviewProbe = stub.mock.calls.some(([u]) =>
      /temoignages|avis|clients|referenzen|recensioni|testimonials/i.test(String(u)),
    );
    expect(reviewProbe).toBe(false);
  });

  it('rejects a soft-404 testimonial page as NOT found', async () => {
    const HOMEPAGE = `<html><head><title>X</title></head><body><a href="/avis">Avis</a></body></html>`;
    vi.stubGlobal('fetch', fetchStub({
      '/avis': { status: 200, body: SOFT_404 },
      '__home__': { body: HOMEPAGE },
    }));

    const result = await analyzeEEAT('https://site.com/');
    expect(result.signals.testimonials.found).toBe(false);
  });

  it('does NOT follow a cross-origin reviews link (trustpilot.com)', async () => {
    const HOMEPAGE = `<html><head><title>X</title></head><body><a href="https://trustpilot.com/reviews/site">Reviews</a></body></html>`;
    const stub = fetchStub({
      'trustpilot.com/reviews': { body: TESTIMONIALS_PAGE },
      '__home__': { body: HOMEPAGE },
    });
    vi.stubGlobal('fetch', stub);

    const result = await analyzeEEAT('https://site.com/');
    expect(result.signals.testimonials.found).toBe(false);
    const fetchedTrustpilot = stub.mock.calls.some(([u]) => String(u).includes('trustpilot.com'));
    expect(fetchedTrustpilot).toBe(false);
  });

  it('reports NOT found when neither homepage nor probe pages have reviews', async () => {
    vi.stubGlobal('fetch', fetchStub({
      '__home__': { body: '<html><head><title>X</title></head><body><a href="/products">P</a></body></html>' },
    }));
    const result = await analyzeEEAT('https://empty.com/');
    expect(result.signals.testimonials.found).toBe(false);
    expect(result.recommendations.join(' ')).toMatch(/témoignages/i);
  });
});

/* ------------------------------------------------------------------ *
 * SSRF / same-origin guard (eeat C-1). The analyzed page is untrusted:
 * its links must not let us fetch cross-origin or internal targets.
 * ------------------------------------------------------------------ */
describe('analyzeEEAT — SSRF + same-origin restriction', () => {
  beforeEach(() => {
    delete process.env.MOZ_API_KEY;
  });

  it('does NOT fetch a cross-host team link (evil.com) nor treat it as the team page', async () => {
    const HOMEPAGE_CROSS = `
      <html><head><title>Site</title></head><body>
        <a href="https://evil.com/team">Our team</a>
      </body></html>`;
    const stub = fetchStub({
      // If the analyzer ever followed it, this would mark a team page found.
      'evil.com/team': { body: TEAM_PAGE },
      '__home__': { body: HOMEPAGE_CROSS },
    });
    vi.stubGlobal('fetch', stub);

    const result = await analyzeEEAT('https://victim.com/');

    // Cross-origin link dropped → falls back to same-origin probes (all 404).
    expect(result.signals.teamPage.found).toBe(false);
    // And evil.com was never contacted.
    const fetchedEvil = stub.mock.calls.some(([u]) =>
      String(u).includes('evil.com'),
    );
    expect(fetchedEvil).toBe(false);
  });

  it('rejects a private-IP / metadata link and NEVER calls fetch for it', async () => {
    const HOMEPAGE_META = `
      <html><head><title>Site</title></head><body>
        <a href="http://169.254.169.254/team">team</a>
      </body></html>`;

    // The metadata host is a sub-resource of victim.com's "site"? No — it's a
    // literal IP, different host → it must be dropped by same-origin first.
    // But to prove the assertSafeUrl layer too, allow it past same-origin by
    // submitting the IP itself, and make the guard throw for it.
    assertSafeUrlMock.mockImplementation(async (input: string) => {
      const host = new URL(input).hostname;
      if (host === '169.254.169.254') {
        throw new SsrfError('IP privée ou réservée', 'private-ip');
      }
      return { url: new URL(input), hostname: host, resolvedIp: '93.184.216.34' };
    });

    const stub = fetchStub({
      '169.254.169.254/team': { body: TEAM_PAGE },
      '__home__': { body: HOMEPAGE_META },
    });
    vi.stubGlobal('fetch', stub);

    // Submit the metadata IP as the page so the link is "same host" — this
    // isolates the assertSafeUrl layer (defence in depth beyond same-origin).
    const result = await analyzeEEAT('http://169.254.169.254/');

    expect(result.signals.teamPage.found).toBe(false);
    // Crucially: fetch was never called for the metadata endpoint.
    const fetchedMeta = stub.mock.calls.some(([u]) =>
      String(u).includes('169.254.169.254'),
    );
    expect(fetchedMeta).toBe(false);
  });

  it('protocol-relative cross-host link (//metadata.internal/team) is dropped, not fetched', async () => {
    const HOMEPAGE_PROTO_REL = `
      <html><head><title>Site</title></head><body>
        <a href="//metadata.google.internal/team">team</a>
      </body></html>`;
    const stub = fetchStub({
      'metadata.google.internal': { body: TEAM_PAGE },
      '__home__': { body: HOMEPAGE_PROTO_REL },
    });
    vi.stubGlobal('fetch', stub);

    const result = await analyzeEEAT('https://victim.com/');
    expect(result.signals.teamPage.found).toBe(false);
    const fetchedMeta = stub.mock.calls.some(([u]) =>
      String(u).includes('metadata.google.internal'),
    );
    expect(fetchedMeta).toBe(false);
  });

  it('allows a same-registrable-domain sub-domain link (team.enigma.swiss)', async () => {
    const HOMEPAGE_SUBDOMAIN = `
      <html><head><title>Enigma</title></head><body>
        <a href="https://team.enigma.swiss/equipe">L'équipe</a>
      </body></html>`;
    vi.stubGlobal('fetch', fetchStub({
      'team.enigma.swiss/equipe': { body: TEAM_PAGE },
      '__home__': { body: HOMEPAGE_SUBDOMAIN },
    }));

    const result = await analyzeEEAT('https://www.enigma.swiss/');
    expect(result.signals.teamPage.found).toBe(true);
  });
});
