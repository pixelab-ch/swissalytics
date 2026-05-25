import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  analyzeEEAT,
  extractLinks,
  findBestCandidate,
  looksLikeSoftError,
  TEAM_KEYWORDS,
  CONTACT_KEYWORDS,
  LEGAL_KEYWORDS,
  type PageLink,
} from '../eeat';
import * as cheerio from 'cheerio';

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

function links(html: string): PageLink[] {
  return extractLinks(cheerio.load(`<html><body>${html}</body></html>`));
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
});
