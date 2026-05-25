import { describe, it, expect } from 'vitest';

import {
  candidateUrls,
  extractLinks,
  findBestCandidate,
  looksLikeSoftError,
  matchesKeyword,
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
