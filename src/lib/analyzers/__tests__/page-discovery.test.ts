import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

/**
 * Stub the SSRF guard so the `fetchFirstAvailable` integration tests are
 * deterministic (no real DNS). Default: every URL is "safe". Mirrors the
 * eeat / schema-org test setup — `fetchRealPage` (called by
 * `fetchFirstAvailable`) calls `assertSafeUrl` first.
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

import {
  candidateUrls,
  extractLinks,
  fetchFirstAvailable,
  fetchPageOutcome,
  fetchRealPage,
  findBestCandidate,
  looksLikeSoftError,
  matchesKeyword,
  MAX_PER_ORIGIN,
  type PageLink,
} from '../page-discovery';
import {
  TEAM_KEYWORDS,
  CONTACT_KEYWORDS,
  LEGAL_KEYWORDS,
  TESTIMONIAL_KEYWORDS,
} from '../eeat';
import * as cheerio from 'cheerio';

/**
 * page-discovery — the generic, link-driven page-discovery helpers extracted
 * from eeat.ts. These are the reusable primitives behind EEAT, testimonials,
 * and schema-org multipage: read REAL links off a page, match them against
 * accent-tolerant / locale-aware keywords on path segments and anchor text,
 * resolve same-origin candidate URLs (capped + scheme-allowlisted), and
 * reject HTTP-200 soft-404s.
 *
 * (These tests previously lived in eeat.test.ts; moved here when the helpers
 * moved to page-discovery.ts. Keyword sets are still imported from eeat.)
 */

function links(html: string): PageLink[] {
  return extractLinks(cheerio.load(`<html><body>${html}</body></html>`));
}

describe('extractLinks', () => {
  it('extracts href + anchor text from <a> tags', () => {
    const result = links('<a href="/fr/lequipe/">Notre équipe</a><a href="/contact">Contact</a>');
    expect(result).toEqual([
      { href: '/fr/lequipe/', text: 'Notre équipe' },
      { href: '/contact', text: 'Contact' },
    ]);
  });

  it('ignores anchors without href and trims whitespace', () => {
    const result = links('<a>no href</a><a href="/x">  spaced  </a>');
    expect(result).toEqual([{ href: '/x', text: 'spaced' }]);
  });
});

describe('matchesKeyword', () => {
  it('matches a keyword as a discrete path segment', () => {
    expect(matchesKeyword({ href: '/fr/lequipe/', text: '' }, TEAM_KEYWORDS)).toBe(true);
  });

  it('does NOT match a keyword embedded in a larger segment', () => {
    expect(matchesKeyword({ href: '/teamwork-blog', text: 'Teamwork' }, TEAM_KEYWORDS)).toBe(false);
  });

  it('matches via anchor text when the href is opaque', () => {
    expect(matchesKeyword({ href: '/p/42', text: 'Notre équipe' }, TEAM_KEYWORDS)).toBe(true);
  });
});

describe('looksLikeSoftError', () => {
  it('flags a French "Page introuvable" title', () => {
    expect(looksLikeSoftError('<title>Page introuvable</title>', '')).toBe(true);
  });

  it('flags a "404" / "Page not found" heading even with HTTP 200', () => {
    expect(looksLikeSoftError('<title>Acme</title><h1>404 — Page not found</h1>', 'Acme')).toBe(true);
  });

  it('flags a German "Seite nicht gefunden"', () => {
    expect(looksLikeSoftError('<title>Seite nicht gefunden</title>', 'Seite nicht gefunden')).toBe(true);
  });

  it('does NOT flag a legitimate team page', () => {
    expect(looksLikeSoftError('<title>Notre équipe — Enigma</title><h1>L\'équipe</h1>', 'Notre équipe — Enigma')).toBe(false);
  });
});

describe('findBestCandidate — team (locale-aware + contracted)', () => {
  it('matches the enigma contracted form /fr/lequipe/', () => {
    const cand = findBestCandidate(links('<a href="/fr/lequipe/">L\'équipe</a>'), TEAM_KEYWORDS);
    expect(cand?.href).toBe('/fr/lequipe/');
  });

  it('matches /l-equipe and /léquipe contractions', () => {
    expect(findBestCandidate(links('<a href="/l-equipe">x</a>'), TEAM_KEYWORDS)?.href).toBe('/l-equipe');
    expect(findBestCandidate(links('<a href="/léquipe">x</a>'), TEAM_KEYWORDS)?.href).toBe('/léquipe');
  });

  it('matches locale-prefixed + trailing-slash /de/ueber-uns/', () => {
    expect(findBestCandidate(links('<a href="/de/ueber-uns/">Über uns</a>'), TEAM_KEYWORDS)?.href).toBe('/de/ueber-uns/');
  });

  it('matches accented /à-propos and /a-propos', () => {
    expect(findBestCandidate(links('<a href="/à-propos">x</a>'), TEAM_KEYWORDS)?.href).toBe('/à-propos');
    expect(findBestCandidate(links('<a href="/a-propos">x</a>'), TEAM_KEYWORDS)?.href).toBe('/a-propos');
  });

  it('matches Italian /chi-siamo', () => {
    expect(findBestCandidate(links('<a href="/it/chi-siamo">Chi siamo</a>'), TEAM_KEYWORDS)?.href).toBe('/it/chi-siamo');
  });

  it('matches /notre-equipe and /qui-sommes-nous', () => {
    expect(findBestCandidate(links('<a href="/notre-equipe">x</a>'), TEAM_KEYWORDS)?.href).toBe('/notre-equipe');
    expect(findBestCandidate(links('<a href="/qui-sommes-nous">x</a>'), TEAM_KEYWORDS)?.href).toBe('/qui-sommes-nous');
  });

  it('matches via anchor TEXT when the href is opaque', () => {
    const cand = findBestCandidate(links('<a href="/p/42">Notre équipe</a>'), TEAM_KEYWORDS);
    expect(cand?.href).toBe('/p/42');
  });

  it('returns null when no candidate present', () => {
    expect(findBestCandidate(links('<a href="/products">Products</a>'), TEAM_KEYWORDS)).toBeNull();
  });

  it('does NOT match /teamwork-blog as a team page (segment boundary)', () => {
    expect(findBestCandidate(links('<a href="/teamwork-blog">Teamwork</a>'), TEAM_KEYWORDS)).toBeNull();
  });
});

describe('findBestCandidate — contact', () => {
  it('matches /kontakt and /contatti and /contattaci', () => {
    expect(findBestCandidate(links('<a href="/de/kontakt">Kontakt</a>'), CONTACT_KEYWORDS)?.href).toBe('/de/kontakt');
    expect(findBestCandidate(links('<a href="/it/contatti">Contatti</a>'), CONTACT_KEYWORDS)?.href).toBe('/it/contatti');
    expect(findBestCandidate(links('<a href="/contattaci">x</a>'), CONTACT_KEYWORDS)?.href).toBe('/contattaci');
  });
});

describe('findBestCandidate — legal', () => {
  it('matches /impressum, /mentions-legales, /note-legali', () => {
    expect(findBestCandidate(links('<a href="/impressum">Impressum</a>'), LEGAL_KEYWORDS)?.href).toBe('/impressum');
    expect(findBestCandidate(links('<a href="/mentions-legales">ML</a>'), LEGAL_KEYWORDS)?.href).toBe('/mentions-legales');
    expect(findBestCandidate(links('<a href="/it/note-legali">NL</a>'), LEGAL_KEYWORDS)?.href).toBe('/it/note-legali');
  });
});

describe('findBestCandidate — testimonials', () => {
  it('matches FR /temoignages, /avis, /references, /clients', () => {
    expect(findBestCandidate(links('<a href="/fr/temoignages/">Témoignages</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/fr/temoignages/');
    expect(findBestCandidate(links('<a href="/avis">Avis</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/avis');
    expect(findBestCandidate(links('<a href="/references">x</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/references');
    expect(findBestCandidate(links('<a href="/clients">x</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/clients');
  });

  it('matches EN /testimonials, /reviews, /case-studies', () => {
    expect(findBestCandidate(links('<a href="/testimonials">x</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/testimonials');
    expect(findBestCandidate(links('<a href="/reviews">x</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/reviews');
    expect(findBestCandidate(links('<a href="/en/case-studies">x</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/en/case-studies');
  });

  it('matches DE /referenzen, /kundenstimmen and IT /testimonianze, /recensioni', () => {
    expect(findBestCandidate(links('<a href="/de/referenzen">x</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/de/referenzen');
    expect(findBestCandidate(links('<a href="/kundenstimmen">x</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/kundenstimmen');
    expect(findBestCandidate(links('<a href="/it/testimonianze">x</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/it/testimonianze');
    expect(findBestCandidate(links('<a href="/it/recensioni">x</a>'), TESTIMONIAL_KEYWORDS)?.href).toBe('/it/recensioni');
  });
});

describe('candidateUrls — same-origin + bounded fan-out', () => {
  const linkList = (hrefs: string[]): PageLink[] =>
    hrefs.map((href) => ({ href, text: 'team' }));

  it('caps the returned candidate list at 3 (I-1)', () => {
    const many = linkList([
      '/team-1/equipe', '/team-2/equipe', '/team-3/equipe',
      '/team-4/equipe', '/team-5/equipe',
    ]);
    const out = candidateUrls(
      'https://site.com/',
      'https://site.com',
      many,
      TEAM_KEYWORDS,
      [],
    );
    expect(out.length).toBe(3);
  });

  it('drops cross-origin and non-http(s) links, keeps same-site ones', () => {
    const mixed = linkList([
      'https://evil.com/team',          // cross-origin → drop
      'javascript:void(0)/team',        // bad scheme → drop (also not parsed as http)
      'ftp://site.com/team',            // bad scheme → drop
      '/equipe',                        // same-origin → keep
      'https://site.com/about-us',      // same-origin absolute → keep
    ]);
    const out = candidateUrls(
      'https://site.com/',
      'https://site.com',
      mixed,
      TEAM_KEYWORDS,
      [],
    );
    expect(out).toEqual([
      'https://site.com/equipe',
      'https://site.com/about-us',
    ]);
  });

  it('falls back to same-origin probe slugs when no link matches', () => {
    const out = candidateUrls(
      'https://site.com/',
      'https://site.com',
      linkList(['/products']).map((l) => ({ ...l, text: 'products' })),
      TEAM_KEYWORDS,
      ['team', 'about'],
    );
    expect(out).toEqual(['https://site.com/team', 'https://site.com/about']);
  });

  it('allows a same-registrable-domain sub-domain link (team.enigma.swiss)', () => {
    const out = candidateUrls(
      'https://www.enigma.swiss/',
      'https://www.enigma.swiss',
      [{ href: 'https://team.enigma.swiss/equipe', text: 'L\'équipe' }],
      TEAM_KEYWORDS,
      [],
    );
    expect(out).toEqual(['https://team.enigma.swiss/equipe']);
  });
});

/* ------------------------------------------------------------------ *
 * fetchFirstAvailable — concurrent candidate fetch, first-success-by-order.
 *
 * Pins the false-timeout fix: raising the per-fetch timeout to 8s without
 * blowing the analyzer budget requires fetching a signal's ≤3 candidates
 * CONCURRENTLY (worst-case wall ≈ one timeout, not N×). These tests prove:
 *   - all candidates are dispatched in one burst (concurrency, not serial);
 *   - the FIRST successful candidate IN ORIGINAL ORDER wins (not first-to-
 *     respond), preserving "best = earliest matching link" semantics;
 *   - a slow-but-valid candidate still resolves (the bug we're fixing);
 *   - soft-404 / HTTP-error candidates are skipped, falling through in order.
 * ------------------------------------------------------------------ */
describe('fetchFirstAvailable — concurrent, first-success-by-order', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useRealTimers();
  });

  const PAGE_A = '<html><head><title>A</title></head><body>A</body></html>';
  const PAGE_B = '<html><head><title>B</title></head><body>B</body></html>';
  const SOFT_404 = '<html><head><title>Page introuvable</title></head><body><h1>404</h1></body></html>';

  it('returns null for an empty candidate list (no fetch)', async () => {
    const stub = vi.fn();
    vi.stubGlobal('fetch', stub);
    expect(await fetchFirstAvailable([])).toBeNull();
    expect(stub).not.toHaveBeenCalled();
  });

  it('dispatches ALL candidates concurrently (one burst, not serial)', async () => {
    let inFlight = 0;
    let maxConcurrent = 0;
    const stub = vi.fn(async () => {
      inFlight++;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return new Response(PAGE_A, { status: 200 });
    });
    vi.stubGlobal('fetch', stub);

    await fetchFirstAvailable([
      'https://site.com/a',
      'https://site.com/b',
      'https://site.com/c',
    ]);

    // If fetches were sequential, max concurrency would be 1.
    expect(maxConcurrent).toBe(3);
    expect(stub).toHaveBeenCalledTimes(3);
  });

  it('picks the FIRST candidate by ORDER, not the first to respond', async () => {
    // First candidate is SLOW (but valid); second is fast. Order must win.
    const stub = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/slow-first')) {
        await new Promise((r) => setTimeout(r, 40));
        return new Response(PAGE_A, { status: 200 });
      }
      // fast second candidate
      return new Response(PAGE_B, { status: 200 });
    });
    vi.stubGlobal('fetch', stub);

    const hit = await fetchFirstAvailable([
      'https://site.com/slow-first',
      'https://site.com/fast-second',
    ]);
    expect(hit?.url).toBe('https://site.com/slow-first');
    expect(hit?.html).toContain('A');
  });

  it('resolves a slow-but-valid candidate that stays UNDER the 8s timeout', async () => {
    // The exact bug: a small site's cold ~3.4s fetch must still resolve, not
    // be aborted as "not found". Simulate ~3.4s (well under 8s) with fake
    // timers so the test is instant.
    vi.useFakeTimers();
    const stub = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 3_400));
      return new Response(PAGE_A, { status: 200 });
    });
    vi.stubGlobal('fetch', stub);

    const promise = fetchFirstAvailable(['https://enigma.swiss/fr/contact/']);
    await vi.advanceTimersByTimeAsync(3_400);
    const hit = await promise;
    expect(hit?.url).toBe('https://enigma.swiss/fr/contact/');
    expect(hit?.html).toContain('A');
  });

  it('skips a soft-404 first candidate and falls through to the next valid one (in order)', async () => {
    const stub = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/soft404')) return new Response(SOFT_404, { status: 200 });
      return new Response(PAGE_B, { status: 200 });
    });
    vi.stubGlobal('fetch', stub);

    const hit = await fetchFirstAvailable([
      'https://site.com/soft404',
      'https://site.com/real',
    ]);
    expect(hit?.url).toBe('https://site.com/real');
    expect(hit?.html).toContain('B');
  });

  it('skips an HTTP-error first candidate and returns the next', async () => {
    const stub = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/broken')) return new Response('err', { status: 500 });
      return new Response(PAGE_A, { status: 200 });
    });
    vi.stubGlobal('fetch', stub);

    const hit = await fetchFirstAvailable([
      'https://site.com/broken',
      'https://site.com/ok',
    ]);
    expect(hit?.url).toBe('https://site.com/ok');
  });

  it('returns null when EVERY candidate fails (all 404 / soft-404)', async () => {
    const stub = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/soft')) return new Response(SOFT_404, { status: 200 });
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', stub);

    const hit = await fetchFirstAvailable([
      'https://site.com/soft',
      'https://site.com/missing',
    ]);
    expect(hit).toBeNull();
  });
});

describe('fetchPageOutcome — classification', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  const PAGE = '<html><head><title>Real</title></head><body>ok</body></html>';
  const SOFT_404 = '<html><head><title>Page introuvable</title></head><body><h1>404</h1></body></html>';

  it('returns ok with html for a 200 real page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(PAGE, { status: 200 })));
    const o = await fetchPageOutcome('https://site.com/x');
    expect(o.kind).toBe('ok');
    if (o.kind === 'ok') expect(o.html).toContain('ok');
  });

  it('returns absent for a 200 soft-404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(SOFT_404, { status: 200 })));
    expect((await fetchPageOutcome('https://site.com/x')).kind).toBe('absent');
  });

  it('returns absent for HTTP 404 and 410', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nf', { status: 404 })));
    expect((await fetchPageOutcome('https://site.com/a')).kind).toBe('absent');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 410 })));
    expect((await fetchPageOutcome('https://site.com/b')).kind).toBe('absent');
  });

  it('returns unknown for 403, 429 and 5xx (blocked / server error, page may exist)', async () => {
    for (const status of [403, 429, 500, 503]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status })));
      expect((await fetchPageOutcome('https://site.com/x')).kind).toBe('unknown');
    }
  });

  it('returns unknown when fetch throws (abort / network error)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('aborted'); }));
    expect((await fetchPageOutcome('https://site.com/x')).kind).toBe('unknown');
  });
});

describe('fetchRealPage — wrapper preserves string|null', () => {
  afterEach(() => vi.restoreAllMocks());
  it('returns html on ok, null on absent and unknown', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<title>x</title><body>hi</body>', { status: 200 })));
    expect(await fetchRealPage('https://site.com/x')).toContain('hi');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nf', { status: 404 })));
    expect(await fetchRealPage('https://site.com/x')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    expect(await fetchRealPage('https://site.com/x')).toBeNull();
  });
});

describe('fetchPageOutcome — per-origin concurrency limiter (Option A)', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('caps concurrent fetches to the SAME origin at MAX_PER_ORIGIN', async () => {
    let inFlight = 0;
    let maxConcurrent = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      inFlight++; maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return new Response('<title>x</title><body>ok</body>', { status: 200 });
    }));

    const urls = Array.from({ length: 20 }, (_, i) => `https://same.com/p${i}`);
    await Promise.all(urls.map((u) => fetchPageOutcome(u)));

    expect(maxConcurrent).toBeLessThanOrEqual(MAX_PER_ORIGIN);
    expect(maxConcurrent).toBeGreaterThan(1); // not serialized
  });

  it('does NOT throttle across DIFFERENT origins', async () => {
    let inFlight = 0;
    let maxConcurrent = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      inFlight++; maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return new Response('<title>x</title><body>ok</body>', { status: 200 });
    }));

    // 8 distinct origins → all should run at once (limiter is per-origin).
    const urls = Array.from({ length: 8 }, (_, i) => `https://host${i}.com/p`);
    await Promise.all(urls.map((u) => fetchPageOutcome(u)));
    expect(maxConcurrent).toBe(8);
  });
});
