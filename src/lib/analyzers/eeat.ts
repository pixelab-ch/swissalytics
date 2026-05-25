/**
 * Analyseur E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
 * 
 * Évalue les signaux de confiance Google:
 * - Page équipe (Team/About)
 * - Mentions légales
 * - Page contact
 * - Témoignages clients
 * - Backlinks de qualité
 * - Présence auteurs identifiés
 */

import * as cheerio from 'cheerio';
import { assertSafeUrl, SsrfError } from '@/lib/security/ssrf';

export interface EEATResult {
  score: number;
  signals: {
    teamPage: {
      found: boolean;
      quality: 'high' | 'medium' | 'low' | 'none';
      authorsCount: number;
    };
    legalMentions: boolean;
    contactPage: {
      found: boolean;
      hasEmail: boolean;
      hasPhone: boolean;
      hasAddress: boolean;
    };
    testimonials: {
      found: boolean;
      count: number;
      hasSchema: boolean;
    };
    backlinks: {
      total: number;
      quality: 'high' | 'medium' | 'low' | 'none';
      domains: number;
    };
    authorBios: {
      found: boolean;
      count: number;
    };
  };
  recommendations: string[];
}

/** A link extracted from the submitted page: href + visible anchor text. */
export interface PageLink {
  href: string;
  text: string;
}

const UA = 'Swissalytics/1.0 (+https://swissalytics.com)';

/** Per-fetch hard timeout (ms). Keeps sockets from outliving the analyzer's
 *  overall `withTimeout` budget — see eeat I-2. */
const FETCH_TIMEOUT_MS = 4_000;

/** Max candidate URLs fetched per signal — see eeat I-1 (route promises ≤3). */
const MAX_CANDIDATES = 3;

/**
 * Registrable-domain-ish key for same-origin restriction (no PSL dependency):
 * exact hostname or its last two labels (`team.enigma.swiss` → `enigma.swiss`).
 * Good enough to keep candidate fetches on the analyzed site and drop
 * cross-origin links (e.g. an external `linkedin.com/.../about`).
 */
function siteKey(hostname: string): string {
  const labels = hostname.toLowerCase().split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  return labels.slice(-2).join('.');
}

/**
 * True when `candidate` belongs to the same site as `pageUrl`: same exact
 * host, or sharing the same registrable domain (sub-domain of it).
 */
function isSameSite(candidate: URL, pageHost: string): boolean {
  const candHost = candidate.hostname.toLowerCase();
  const base = pageHost.toLowerCase();
  if (candHost === base) return true;
  return siteKey(candHost) === siteKey(base);
}

/**
 * Keyword sets for the page-based trust signals. Matched (accent-tolerant)
 * against link PATH SEGMENTS and anchor text. Locale prefixes (`/fr/`,
 * `/de/`, …) and trailing slashes are handled by the segment regex, so
 * keywords here are bare slugs only.
 *
 * Team includes the contracted French forms enigma.swiss uses
 * (`lequipe`, `l-equipe`, `léquipe`) on top of `equipe`/`équipe`.
 */
export const TEAM_KEYWORDS = [
  // FR
  'team', 'equipe', 'équipe', 'lequipe', 'l-equipe', 'léquipe',
  'notre-equipe', 'notre-équipe', 'a-propos', 'à-propos', 'apropos',
  'qui-sommes-nous', 'about', 'about-us',
  // DE
  'ueber-uns', 'über-uns', 'unternehmen',
  // IT
  'chi-siamo',
];
export const CONTACT_KEYWORDS = [
  'contact', 'contactez-nous', 'nous-contacter',
  'kontakt', 'contatti', 'contattaci',
];
export const LEGAL_KEYWORDS = [
  'mentions-legales', 'mentions-légales', 'impressum', 'datenschutz',
  'agb', 'privacy', 'privacy-policy', 'cgu', 'cgv', 'legal', 'legal-notice',
  'note-legali', 'imprint',
];

/**
 * Extract every `<a href>` link (href + trimmed anchor text) from a page.
 */
export function extractLinks($: cheerio.CheerioAPI): PageLink[] {
  const out: PageLink[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    out.push({ href, text: $(el).text().replace(/\s+/g, ' ').trim() });
  });
  return out;
}

/**
 * Path-segment / anchor-text keyword match.
 *
 * A keyword counts when it appears as a discrete path segment (bounded by
 * `/`, `-`, `_`, `.`, `?`, `#` or string ends) — so `/fr/lequipe/` and
 * `/about-us` match but `/teamwork-blog` does not — OR when it appears as a
 * whole word in the anchor text (e.g. opaque href `/p/42` with text
 * "Notre équipe"). Case- and accent-insensitive on both sides.
 */
function matchesKeyword(link: PageLink, keywords: string[]): boolean {
  const href = link.href.toLowerCase();
  const text = link.text.toLowerCase();
  return keywords.some((kw) => {
    const k = kw.toLowerCase();
    const seg = new RegExp(`(?:^|[/_-])${escapeRe(k)}(?:[/._?#-]|$)`);
    if (seg.test(href)) return true;
    // Anchor-text fallback: keyword as a whole word (hyphens → spaces).
    const word = new RegExp(`(?:^|\\W)${escapeRe(k.replace(/-/g, ' '))}(?:\\W|$)`);
    return word.test(text);
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pick the best candidate link for a signal: the first link whose path or
 * anchor text matches one of the keywords. Returns null when none match.
 */
export function findBestCandidate(linksList: PageLink[], keywords: string[]): PageLink | null {
  return linksList.find((l) => matchesKeyword(l, keywords)) ?? null;
}

/**
 * Detect HTTP-200 soft-404 / error pages. Many sites (incl. enigma.swiss)
 * answer 200 for unknown routes and render a "not found" shell — trusting
 * `response.ok` alone yields false positives. We inspect the `<title>` and
 * any visible heading text for not-found markers.
 */
export function looksLikeSoftError(html: string, title: string): boolean {
  const $ = cheerio.load(html);
  const haystack = `${title} ${$('title').text()} ${$('h1, h2').text()}`.toLowerCase();
  return /\b404\b|not\s*found|page\s*introuvable|introuvable|nicht\s*gefunden|non\s*trovata|seite\s*nicht|page\s*non\s*trouv/i.test(
    haystack
  );
}

/**
 * Fetch a page once, returning its HTML — or null on HTTP error / soft-404.
 *
 * The URL may be derived from the (untrusted) analyzed page's links, so every
 * fetch passes through `assertSafeUrl` first (resolves DNS, blocks private /
 * link-local / metadata IPs) — see eeat C-1. An `SsrfError` (or any rejection
 * from the guard) is treated as "not found" rather than crashing the analyzer.
 * A per-fetch `AbortController` caps the socket lifetime so a slow host can't
 * outlive the analyzer's overall timeout (eeat I-2).
 */
async function fetchRealPage(url: string): Promise<string | null> {
  try {
    await assertSafeUrl(url);
  } catch (err) {
    if (err instanceof SsrfError) {
      console.log(`[E-E-A-T] URL rejetée (SSRF): ${url} (${err.code})`);
      return null;
    }
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const html = await response.text();
    const title = cheerio.load(html)('title').text();
    if (looksLikeSoftError(html, title)) {
      console.log(`[E-E-A-T] Soft-404 rejeté: ${url}`);
      return null;
    }
    return html;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve candidate URLs for a signal: prefer the real links found on the
 * submitted page (resolved against the page URL), falling back to a small
 * deduped list of guessed slugs only when no link matched.
 */
export function candidateUrls(
  pageUrl: string,
  baseUrl: string,
  linksList: PageLink[],
  keywords: string[],
  fallbackSlugs: string[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string | undefined) => {
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  const pageHost = (() => {
    try {
      return new URL(pageUrl).hostname;
    } catch {
      return '';
    }
  })();

  // 1. Link-driven: matching links from the page, resolved absolute, but
  //    restricted to safe schemes AND the SAME SITE as the analyzed page.
  //    Dropping cross-origin links is both an SSRF defence (eeat C-1) and a
  //    correctness fix — an external `linkedin.com/.../about` is NOT the
  //    site's team page.
  for (const link of linksList) {
    if (!matchesKeyword(link, keywords)) continue;
    if (/^(tel:|mailto:|javascript:|#)/i.test(link.href)) continue;
    try {
      const abs = new URL(link.href, pageUrl);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
      if (pageHost && !isSameSite(abs, pageHost)) continue;
      push(abs.href);
    } catch {
      // ignore unparseable hrefs
    }
  }

  // 2. Safety-net hardcoded probes ONLY when no link matched. (Same-origin
  //    by construction — built off baseUrl.)
  if (out.length === 0) {
    for (const slug of fallbackSlugs) push(`${baseUrl}/${slug}`);
  }

  // I-1: bound the fan-out so a page full of soft-404ing matches can't eat
  //      the whole fetch budget (route promises ≤3 candidate fetches/signal).
  return out.slice(0, MAX_CANDIDATES);
}

export async function analyzeEEAT(url: string): Promise<EEATResult> {
  console.log(`[E-E-A-T] Démarrage analyse de ${url}...`);

  try {
    const baseUrl = new URL(url).origin;

    // Fetch the submitted page ONCE; everything else is link-driven off it.
    const homepageHtml = await fetchRealPage(url);
    const $home = cheerio.load(homepageHtml ?? '');
    const pageLinks = extractLinks($home);

    // All signal probes run in ONE Promise.all batch (incl. author bios,
    // which reuses the already-fetched homepage HTML — no refetch).
    const [teamPage, legalMentions, contactPage, testimonials, backlinks, authorBios] = await Promise.all([
      analyzeTeamPage(url, baseUrl, pageLinks),
      checkLegalMentions(url, baseUrl, pageLinks),
      analyzeContactPage(url, baseUrl, pageLinks),
      analyzeTestimonials(baseUrl),
      analyzeBacklinks(url),
      analyzeAuthorBios($home),
    ]);

    const signals = {
      teamPage,
      legalMentions,
      contactPage,
      testimonials,
      backlinks,
      authorBios,
    };

    // Calcul score E-E-A-T
    const score = calculateEEATScore(signals);

    // Recommandations
    const recommendations = generateEEATRecommendations(signals);

    return {
      score,
      signals,
      recommendations,
    };

  } catch (error) {
    console.error('[E-E-A-T] Erreur:', error);

    // Fallback données simulées
    return simulateEEATData();
  }
}

/**
 * Analyser page équipe — pilotée par les liens réels de la page soumise.
 */
async function analyzeTeamPage(
  pageUrl: string,
  baseUrl: string,
  pageLinks: PageLink[],
): Promise<{
  found: boolean;
  quality: 'high' | 'medium' | 'low' | 'none';
  authorsCount: number;
}> {
  try {
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, TEAM_KEYWORDS, [
      'team', 'about', 'a-propos', 'qui-sommes-nous', 'equipe',
    ]);

    for (const url of urls) {
      const html = await fetchRealPage(url);
      if (!html) continue;

      const $ = cheerio.load(html);

      // Chercher Schema.org Person dans JSON-LD
      let authorElements = 0;
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const content = $(el).html();
          if (content) {
            const json = JSON.parse(content);
            // Vérifier si c'est un tableau avec @graph
            if (json['@graph']) {
              authorElements = json['@graph'].filter((item: Record<string, unknown>) => item['@type'] === 'Person').length;
            } else if (json['@type'] === 'Person') {
              authorElements = 1;
            }
          }
        } catch {
          // Ignorer erreurs parsing
        }
      });

      // Si pas de JSON-LD, chercher balises HTML classiques
      if (authorElements === 0) {
        authorElements = $('[itemtype*="Person"], .author, .team-member, .profile').length;
      }

      const hasBios = $('p').filter((_, el) => {
        const text = $(el).text();
        return text.length > 100 && /expert|spécialis|fondateur|ceo|directeur|cto|cmo/i.test(text);
      }).length;

      let quality: 'high' | 'medium' | 'low' | 'none' = 'none';

      if (authorElements >= 3 && hasBios >= 3) {
        quality = 'high';
      } else if (authorElements >= 2 || hasBios >= 2) {
        quality = 'medium';
      } else if (authorElements >= 1) {
        quality = 'low';
      }

      console.log(`[E-E-A-T] Page équipe trouvée: ${url}, ${authorElements} auteurs, qualité: ${quality}`);

      return {
        found: true,
        quality,
        authorsCount: authorElements,
      };
    }

    return { found: false, quality: 'none', authorsCount: 0 };

  } catch (error) {
    console.error('[E-E-A-T] Erreur Team Page:', error);
    return { found: false, quality: 'none', authorsCount: 0 };
  }
}

/**
 * Vérifier mentions légales — pilotée par les liens réels de la page.
 */
async function checkLegalMentions(
  pageUrl: string,
  baseUrl: string,
  pageLinks: PageLink[],
): Promise<boolean> {
  try {
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, LEGAL_KEYWORDS, [
      'mentions-legales', 'legal', 'legal-notice', 'imprint', 'impressum',
    ]);

    for (const url of urls) {
      const html = await fetchRealPage(url);
      if (html) return true;
    }

    return false;

  } catch {
    return false;
  }
}

/**
 * Analyser page contact — pilotée par les liens réels de la page.
 */
async function analyzeContactPage(
  pageUrl: string,
  baseUrl: string,
  pageLinks: PageLink[],
): Promise<{
  found: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
}> {
  try {
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, CONTACT_KEYWORDS, [
      'contact', 'contactez-nous', 'kontakt', 'contatti',
    ]);

    for (const url of urls) {
      const html = await fetchRealPage(url);
      if (!html) continue;

      const $ = cheerio.load(html);
      const text = $('body').text().toLowerCase();

      const hasEmail = /@/.test(text) || $('a[href^="mailto:"]').length > 0;
      const hasPhone = /\+?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2,3}/.test(text) || $('a[href^="tel:"]').length > 0;
      const hasAddress = /adresse|address|rue|street|avenue/i.test(text);

      return {
        found: true,
        hasEmail,
        hasPhone,
        hasAddress,
      };
    }

    return {
      found: false,
      hasEmail: false,
      hasPhone: false,
      hasAddress: false,
    };

  } catch (error) {
    console.error('[E-E-A-T] Erreur Contact Page:', error);
    return {
      found: false,
      hasEmail: false,
      hasPhone: false,
      hasAddress: false,
    };
  }
}

/**
 * Analyser témoignages clients
 */
async function analyzeTestimonials(baseUrl: string): Promise<{
  found: boolean;
  count: number;
  hasSchema: boolean;
}> {
  try {
    const testimonialUrls = [
      `${baseUrl}/testimonials`,
      `${baseUrl}/temoignages`,
      `${baseUrl}/avis`,
      `${baseUrl}/clients`,
      baseUrl, // Page d'accueil peut avoir testimonials
    ];
    
    for (const url of testimonialUrls) {
      // C-1: these URLs are derived from the (validated) origin, but guard
      // defensively before every fetch. I-2: per-fetch abort so a slow host
      // can't outlive the analyzer budget. M-3: reuse the shared UA constant.
      try {
        await assertSafeUrl(url);
      } catch {
        continue;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': UA },
          signal: controller.signal,
        });
      } catch {
        continue;
      } finally {
        clearTimeout(timer);
      }

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Chercher Review Schema dans JSON-LD
        let reviewCount = 0;
        let hasSchema = false;
        
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const content = $(el).html();
            if (content) {
              const json = JSON.parse(content);
              // Vérifier si c'est un tableau avec @graph
              if (json['@graph']) {
                const reviews = json['@graph'].filter((item: Record<string, unknown>) => item['@type'] === 'Review');
                if (reviews.length > 0) {
                  reviewCount = reviews.length;
                  hasSchema = true;
                }
              } else if (json['@type'] === 'Review') {
                reviewCount = 1;
                hasSchema = true;
              }
            }
          } catch {
            // Ignorer erreurs parsing
          }
        });

        // Si pas de JSON-LD, chercher balises HTML classiques
        if (reviewCount === 0) {
          reviewCount = $('.testimonial, .review, .avis, [itemtype*="Review"]').length;
          hasSchema = $('script[type="application/ld+json"]').filter((_, el) => {
            const content = $(el).html();
            return content ? /Review|Rating/i.test(content) : false;
          }).length > 0;
        }
        
        if (reviewCount > 0) {
          console.log(`[E-E-A-T] Témoignages trouvés: ${url}, ${reviewCount} avis, Schema: ${hasSchema}`);
          return {
            found: true,
            count: reviewCount,
            hasSchema,
          };
        }
      }
    }
    
    return { found: false, count: 0, hasSchema: false };
    
  } catch (error) {
    console.error('[E-E-A-T] Erreur Testimonials:', error);
    return { found: false, count: 0, hasSchema: false };
  }
}

/**
 * Analyser backlinks (via API externe ou simulation)
 */
async function analyzeBacklinks(url: string): Promise<{
  total: number;
  quality: 'high' | 'medium' | 'low' | 'none';
  domains: number;
}> {
  try {
    // Option: Utiliser Moz API, Ahrefs API, ou SEMrush API
    // Pour MVP, on simule ou utilise un service gratuit limité
    
    const mozKey = process.env.MOZ_API_KEY;
    
    if (!mozKey) {
      console.warn('[E-E-A-T] MOZ_API_KEY non configuré - simulation backlinks');
      
      // Simulation basée sur domaine
      const domain = new URL(url).hostname;
      const isEstablished = /\.ch$|\.com$|\.fr$/.test(domain);
      
      return {
        total: isEstablished ? 25 : 5,
        quality: isEstablished ? 'medium' : 'low',
        domains: isEstablished ? 15 : 3,
      };
    }
    
    // Appel Moz API (nécessite authentification)
    // TODO: Implémenter vraie requête Moz Link API
    
    return {
      total: 0,
      quality: 'none',
      domains: 0,
    };
    
  } catch (error) {
    console.error('[E-E-A-T] Erreur Backlinks:', error);
    return {
      total: 0,
      quality: 'none',
      domains: 0,
    };
  }
}

/**
 * Analyser présence auteurs identifiés — réutilise le HTML de la page
 * d'accueil déjà chargé (pas de refetch).
 */
async function analyzeAuthorBios($: cheerio.CheerioAPI): Promise<{
  found: boolean;
  count: number;
}> {
  try {
    // Chercher Schema.org Person
    const personSchemas = $('script[type="application/ld+json"]').filter((_, el) => {
      const content = $(el).html();
      return content ? /Person|ProfilePage/i.test(content) : false;
    }).length;

    // Chercher balises author
    const authorTags = $('[rel="author"], .author-bio, .author-profile').length;

    const count = personSchemas + authorTags;

    return {
      found: count > 0,
      count,
    };

  } catch (error) {
    console.error('[E-E-A-T] Erreur Author Bios:', error);
    return {
      found: false,
      count: 0,
    };
  }
}

/**
 * Calcul score E-E-A-T
 */
function calculateEEATScore(signals: EEATResult['signals']): number {
  let score = 0;
  
  // Team Page (25%)
  if (signals.teamPage.found) {
    const qualityScores = { high: 25, medium: 18, low: 10, none: 0 };
    score += qualityScores[signals.teamPage.quality];
  }
  
  // Legal Mentions (10%)
  if (signals.legalMentions) {
    score += 10;
  }
  
  // Contact Page (15%)
  if (signals.contactPage.found) {
    score += 5;
    if (signals.contactPage.hasEmail) score += 3;
    if (signals.contactPage.hasPhone) score += 3;
    if (signals.contactPage.hasAddress) score += 4;
  }
  
  // Testimonials (20%)
  if (signals.testimonials.found) {
    score += 10;
    if (signals.testimonials.count >= 5) score += 5;
    if (signals.testimonials.hasSchema) score += 5;
  }
  
  // Backlinks (20%)
  const backlinkScores = { high: 20, medium: 13, low: 6, none: 0 };
  score += backlinkScores[signals.backlinks.quality];
  
  // Author Bios (10%)
  if (signals.authorBios.found) {
    score += Math.min(signals.authorBios.count * 3, 10);
  }
  
  return Math.round(score);
}

/**
 * Générer recommandations E-E-A-T
 */
function generateEEATRecommendations(signals: EEATResult['signals']): string[] {
  const recs: string[] = [];
  
  // Priorité haute
  if (!signals.teamPage.found || signals.teamPage.quality === 'low') {
    recs.push('Créer page équipe détaillée avec photos, bios, expertise de chaque membre');
  }
  
  if (!signals.authorBios.found) {
    recs.push('Ajouter Schema.org Person/ProfilePage pour identifier auteurs de contenu');
  }
  
  if (!signals.testimonials.found) {
    recs.push('Publier témoignages clients avec Review Schema pour crédibilité');
  }
  
  // Priorité moyenne
  if (!signals.contactPage.found || (!signals.contactPage.hasEmail && !signals.contactPage.hasPhone)) {
    recs.push('Améliorer page contact avec email, téléphone, adresse physique');
  }
  
  if (!signals.legalMentions) {
    recs.push('Ajouter mentions légales complètes (obligatoire en Suisse/UE)');
  }
  
  if (signals.backlinks.quality === 'low' || signals.backlinks.quality === 'none') {
    recs.push('Obtenir backlinks de sites autoritaires (guest posts, partenariats)');
  }
  
  return recs.slice(0, 4); // Top 4 recommandations
}

/**
 * Simulation données E-E-A-T (développement)
 */
function simulateEEATData(): EEATResult {
  return {
    score: 52,
    signals: {
      teamPage: {
        found: false,
        quality: 'none',
        authorsCount: 0,
      },
      legalMentions: true,
      contactPage: {
        found: true,
        hasEmail: true,
        hasPhone: false,
        hasAddress: false,
      },
      testimonials: {
        found: false,
        count: 0,
        hasSchema: false,
      },
      backlinks: {
        total: 15,
        quality: 'medium',
        domains: 8,
      },
      authorBios: {
        found: false,
        count: 0,
      },
    },
    recommendations: [
      'Créer page équipe détaillée avec photos, bios, expertise de chaque membre',
      'Ajouter Schema.org Person/ProfilePage pour identifier auteurs de contenu',
      'Publier témoignages clients avec Review Schema pour crédibilité',
      'Améliorer page contact avec email, téléphone, adresse physique',
    ],
  };
}
