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
import {
  type PageLink,
  type PageContext,
  type SignalState,
  type ProbeResult,
  extractLinks,
  matchesKeyword,
  findBestCandidate,
  looksLikeSoftError,
  fetchRealPage,
  fetchFirstAvailable,
  fetchPageOutcome,
  candidateUrls,
  probeSignal,
  TEAM_KEYWORDS,
  CONTACT_KEYWORDS,
  LEGAL_KEYWORDS,
  TESTIMONIAL_KEYWORDS,
} from './page-discovery';

// Re-export the shared discovery helpers + keyword sets so existing importers
// (and tests) that pull them from '../eeat' keep working. The canonical home
// is now page-discovery.ts.
export {
  type PageLink,
  type PageContext,
  type SignalState,
  type ProbeResult,
  extractLinks,
  matchesKeyword,
  findBestCandidate,
  looksLikeSoftError,
  candidateUrls,
  TEAM_KEYWORDS,
  CONTACT_KEYWORDS,
  LEGAL_KEYWORDS,
  TESTIMONIAL_KEYWORDS,
};

export interface EEATResult {
  score: number;
  signals: {
    teamPage: {
      found: boolean;
      state: SignalState;
      quality: 'high' | 'medium' | 'low' | 'none';
      authorsCount: number;
    };
    legalMentions: { found: boolean; state: SignalState };
    contactPage: {
      found: boolean;
      state: SignalState;
      hasEmail: boolean;
      hasPhone: boolean;
      hasAddress: boolean;
    };
    testimonials: {
      found: boolean;
      state: SignalState;
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

/**
 * Analyse E-E-A-T — link-driven off the homepage that the route already
 * fetched ONCE (`PageContext`). The homepage is NOT re-fetched here; sub-pages
 * (team / contact / legal / testimonials) still go through the guarded
 * `fetchRealPage`. `ctx` is null when the homepage was unreachable / soft-404
 * / SSRF-rejected — that degrades exactly as before (empty HTML + empty links,
 * so candidate discovery falls back to the minimal same-origin probe slugs).
 */
export async function analyzeEEAT(url: string, ctx: PageContext | null): Promise<EEATResult> {
  console.log(`[E-E-A-T] Démarrage analyse de ${url}...`);

  try {
    const baseUrl = new URL(url).origin;

    // Homepage was fetched ONCE upstream (PageContext); reuse it — no refetch.
    // A null ctx means the homepage was unreachable: behave as before, i.e. as
    // if `fetchRealPage` had returned null (empty HTML, no links).
    const homepageHtml = ctx?.html ?? '';
    const $home = ctx?.$ ?? cheerio.load('');
    const pageLinks = ctx?.links ?? [];
    const sitemapUrls = ctx?.sitemapUrls ?? [];

    // All signal probes run in ONE Promise.all batch (incl. author bios,
    // which reuses the already-fetched homepage HTML — no refetch).
    const [teamPage, legalMentions, contactPage, testimonials, backlinks, authorBios] = await Promise.all([
      analyzeTeamPage(url, baseUrl, pageLinks, sitemapUrls),
      checkLegalMentions(url, baseUrl, pageLinks, sitemapUrls),
      analyzeContactPage(url, baseUrl, pageLinks, sitemapUrls),
      analyzeTestimonials(url, baseUrl, pageLinks, homepageHtml, sitemapUrls),
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
  sitemapUrls: string[] = [],
): Promise<{
  found: boolean;
  state: SignalState;
  quality: 'high' | 'medium' | 'low' | 'none';
  authorsCount: number;
}> {
  try {
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, TEAM_KEYWORDS, [
      'team', 'about', 'a-propos', 'qui-sommes-nous', 'equipe',
    ], sitemapUrls);

    const probe = await probeSignal(urls);
    if (probe.state === 'present') {
      const { url, html } = probe;
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

      return { found: true, state: 'present', quality, authorsCount: authorElements };
    }

    return { found: false, state: probe.state, quality: 'none', authorsCount: 0 };

  } catch (error) {
    console.error('[E-E-A-T] Erreur Team Page:', error);
    return { found: false, state: 'unverified', quality: 'none', authorsCount: 0 };
  }
}

/**
 * Vérifier mentions légales — pilotée par les liens réels de la page.
 */
async function checkLegalMentions(
  pageUrl: string,
  baseUrl: string,
  pageLinks: PageLink[],
  sitemapUrls: string[] = [],
): Promise<{ found: boolean; state: SignalState }> {
  try {
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, LEGAL_KEYWORDS, [
      'mentions-legales', 'legal', 'legal-notice', 'imprint', 'impressum',
    ], sitemapUrls);

    const probe = await probeSignal(urls);
    return { found: probe.state === 'present', state: probe.state };

  } catch {
    return { found: false, state: 'unverified' };
  }
}

/**
 * Analyser page contact — pilotée par les liens réels de la page.
 */
async function analyzeContactPage(
  pageUrl: string,
  baseUrl: string,
  pageLinks: PageLink[],
  sitemapUrls: string[] = [],
): Promise<{
  found: boolean;
  state: SignalState;
  hasEmail: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
}> {
  try {
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, CONTACT_KEYWORDS, [
      'contact', 'contactez-nous', 'kontakt', 'contatti',
    ], sitemapUrls);

    const probe = await probeSignal(urls);
    if (probe.state === 'present') {
      const $ = cheerio.load(probe.html);
      const text = $('body').text().toLowerCase();

      const hasEmail = /@/.test(text) || $('a[href^="mailto:"]').length > 0;
      const hasPhone = /\+?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2,3}/.test(text) || $('a[href^="tel:"]').length > 0;
      const hasAddress = /adresse|address|rue|street|avenue/i.test(text);

      return { found: true, state: 'present', hasEmail, hasPhone, hasAddress };
    }

    return { found: false, state: probe.state, hasEmail: false, hasPhone: false, hasAddress: false };

  } catch (error) {
    console.error('[E-E-A-T] Erreur Contact Page:', error);
    return { found: false, state: 'unverified', hasEmail: false, hasPhone: false, hasAddress: false };
  }
}

/**
 * Detect reviews/testimonials in a single already-parsed page: Review JSON-LD
 * first (authoritative, sets `hasSchema`), then classic HTML markers
 * (`.testimonial`/`.review`/`.avis`/`[itemtype*="Review"]`). Pure — no fetch.
 */
function detectTestimonials($: cheerio.CheerioAPI): { count: number; hasSchema: boolean } {
  let reviewCount = 0;
  let hasSchema = false;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const json = JSON.parse(content);
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

  return { count: reviewCount, hasSchema };
}

/**
 * Analyser témoignages clients — piloté par les liens réels de la page.
 *
 * Special: a page that fetches ok but has 0 reviews is verified-absent, not
 * present. We use `fetchPageOutcome` directly per candidate (not `probeSignal`)
 * so we can apply the per-page review predicate. An `unknown` outcome for any
 * candidate marks the whole signal as unverified (we can't confirm absence).
 */
async function analyzeTestimonials(
  pageUrl: string,
  baseUrl: string,
  pageLinks: PageLink[],
  homepageHtml: string,
  sitemapUrls: string[] = [],
): Promise<{
  found: boolean;
  state: SignalState;
  count: number;
  hasSchema: boolean;
}> {
  try {
    // 1. On-page testimonials on the homepage (reuse already-fetched HTML).
    if (homepageHtml) {
      const onHome = detectTestimonials(cheerio.load(homepageHtml));
      if (onHome.count > 0) {
        console.log(`[E-E-A-T] Témoignages trouvés sur l'accueil: ${onHome.count} avis, Schema: ${onHome.hasSchema}`);
        return { found: true, state: 'present', count: onHome.count, hasSchema: onHome.hasSchema };
      }
    }

    // 2. Link-driven discovery of dedicated review/testimonial pages.
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, TESTIMONIAL_KEYWORDS, [
      'testimonials', 'temoignages', 'avis', 'clients', 'referenzen', 'recensioni',
    ], sitemapUrls);

    if (urls.length === 0) return { found: false, state: 'absent', count: 0, hasSchema: false };

    // Fetch all (≤3) candidates concurrently. A page that fetches ok but has
    // 0 reviews is verified review-less (not present, not unverified). An
    // unknown outcome means we couldn't determine if reviews exist there.
    const outcomes = await Promise.all(urls.map((u) => fetchPageOutcome(u)));
    let sawUnknown = false;
    for (let i = 0; i < outcomes.length; i++) {
      const o = outcomes[i];
      if (o.kind === 'ok') {
        const { count, hasSchema } = detectTestimonials(cheerio.load(o.html));
        if (count > 0) {
          console.log(`[E-E-A-T] Témoignages trouvés: ${urls[i]}, ${count} avis, Schema: ${hasSchema}`);
          return { found: true, state: 'present', count, hasSchema };
        }
        // fetched ok but no reviews → this candidate is verified review-less
      } else if (o.kind === 'unknown') {
        sawUnknown = true;
      }
    }

    // No reviews found anywhere. If something was indeterminate, we can't be
    // sure → unverified; otherwise confidently absent.
    return { found: false, state: sawUnknown ? 'unverified' : 'absent', count: 0, hasSchema: false };

  } catch (error) {
    console.error('[E-E-A-T] Erreur Testimonials:', error);
    return { found: false, state: 'unverified', count: 0, hasSchema: false };
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
  if (signals.legalMentions.found) {
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
  if (signals.teamPage.state === 'absent' || (signals.teamPage.found && signals.teamPage.quality === 'low')) {
    recs.push('Créer page équipe détaillée avec photos, bios, expertise de chaque membre');
  }

  if (!signals.authorBios.found) {
    recs.push('Ajouter Schema.org Person/ProfilePage pour identifier auteurs de contenu');
  }

  if (signals.testimonials.state === 'absent') {
    recs.push('Publier témoignages clients avec Review Schema pour crédibilité');
  }

  // Priorité moyenne
  if (signals.contactPage.state !== 'unverified' && (!signals.contactPage.found || (!signals.contactPage.hasEmail && !signals.contactPage.hasPhone))) {
    recs.push('Améliorer page contact avec email, téléphone, adresse physique');
  }

  if (signals.legalMentions.state === 'absent') {
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
        state: 'absent' as SignalState,
        quality: 'none',
        authorsCount: 0,
      },
      legalMentions: { found: true, state: 'present' as SignalState },
      contactPage: {
        found: true,
        state: 'present' as SignalState,
        hasEmail: true,
        hasPhone: false,
        hasAddress: false,
      },
      testimonials: {
        found: false,
        state: 'absent' as SignalState,
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
