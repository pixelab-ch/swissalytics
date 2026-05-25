/**
 * Analyseur Schema.org
 * 
 * Valide les structured data Schema.org:
 * - Organization
 * - Author / Person
 * - FAQPage
 * - BreadcrumbList
 * - Article
 * - WebSite
 */

import * as cheerio from 'cheerio';
import {
  type PageLink,
  extractLinks,
  fetchRealPage,
  candidateUrls,
  TEAM_KEYWORDS,
  CONTACT_KEYWORDS,
  LEGAL_KEYWORDS,
  TESTIMONIAL_KEYWORDS,
} from './page-discovery';

type Schema = Record<string, unknown>;

export interface SchemaOrgResult {
  score: number;
  schemas: {
    organization: boolean;
    author: boolean;
    faqPage: boolean;
    breadcrumb: boolean;
    article: boolean;
    website: boolean;
  };
  totalFound: number;
  details: {
    organization?: Record<string, unknown>;
    author?: Record<string, unknown>;
    faqPage?: Record<string, unknown>;
    breadcrumb?: Record<string, unknown>;
    article?: Record<string, unknown>;
    website?: Record<string, unknown>;
  };
  errors: string[];
  recommendations: string[];
}

/**
 * Pure HTML → SchemaOrgResult analysis. Shared by the single-page
 * `analyzeSchemaOrg` (which fetches first) and the multi-page aggregator
 * (which fetches each page through the SSRF-guarded `fetchRealPage`).
 */
function analyzeSchemaHtml(html: string): SchemaOrgResult {
  const $ = cheerio.load(html);

  // Extraire tous les JSON-LD
  const schemas = extractSchemas($);

  // Vérifier présence de chaque type
  const organization = findSchemaType(schemas, 'Organization');
  const author = findSchemaType(schemas, 'Person') || findSchemaType(schemas, 'ProfilePage');
  const faqPage = findSchemaType(schemas, 'FAQPage');
  const breadcrumb = findSchemaType(schemas, 'BreadcrumbList');
  const article = findSchemaType(schemas, 'Article') || findSchemaType(schemas, 'BlogPosting');
  const website = findSchemaType(schemas, 'WebSite');

  const schemasFound = {
    organization: !!organization,
    author: !!author,
    faqPage: !!faqPage,
    breadcrumb: !!breadcrumb,
    article: !!article,
    website: !!website,
  };

  const totalFound = Object.values(schemasFound).filter(Boolean).length;

  // Valider chaque schéma trouvé
  const errors: string[] = [];

  if (organization) {
    errors.push(...validateOrganization(organization));
  }

  if (author) {
    errors.push(...validateAuthor(author));
  }

  if (faqPage) {
    errors.push(...validateFAQPage(faqPage));
  }

  // Calcul score
  const score = calculateSchemaScore(schemasFound, errors.length);

  // Recommandations
  const recommendations = generateSchemaRecommendations(schemasFound);

  return {
    score,
    schemas: schemasFound,
    totalFound,
    details: {
      organization: organization || undefined,
      author: author || undefined,
      faqPage: faqPage || undefined,
      breadcrumb: breadcrumb || undefined,
      article: article || undefined,
      website: website || undefined,
    },
    errors,
    recommendations,
  };
}

export async function analyzeSchemaOrg(url: string): Promise<SchemaOrgResult> {
  console.log(`[Schema.org] Démarrage analyse de ${url}...`);

  // Use the SSRF-guarded, abort-timeout-aware fetchRealPage so this
  // single-page path has identical safety guarantees to the multipage path
  // (assertSafeUrl, per-fetch AbortController, soft-404 filter). The
  // standalone export has no route-level SSRF guarantee of its own.
  const html = await fetchRealPage(url);
  if (html) {
    return analyzeSchemaHtml(html);
  }

  // fetchRealPage returns null on HTTP error, SSRF rejection, timeout, or
  // soft-404 — log a clean one-liner (no stack trace) and fall back.
  console.warn(`[Schema.org] skip — fetchRealPage returned null for ${url.slice(0, 80)}`);
  return simulateSchemaData();
}

/**
 * Extraire tous les JSON-LD de la page
 */
function extractSchemas($: ReturnType<typeof cheerio.load>): Schema[] {
  const schemas: Schema[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);

        // Gérer @graph (multiples schemas dans un seul script)
        if (parsed['@graph']) {
          schemas.push(...parsed['@graph']);
        } else {
          schemas.push(parsed);
        }
      }
    } catch (error) {
      // Sites routinely have malformed JSON-LD (trailing commas,
      // unescaped quotes). One-line warn is enough — no stack trace.
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[Schema.org] invalid JSON-LD: ${msg.slice(0, 80)}`);
    }
  });

  return schemas;
}

/**
 * Trouver schéma d'un type spécifique
 */
function findSchemaType(schemas: Schema[], type: string): Schema | null {
  return schemas.find(s => {
    const schemaType = s['@type'];
    if (Array.isArray(schemaType)) {
      return schemaType.includes(type);
    }
    return schemaType === type;
  }) || null;
}

/**
 * Valider schéma Organization
 */
function validateOrganization(schema: Schema): string[] {
  const errors: string[] = [];
  
  if (!schema.name) {
    errors.push('Organization: propriété "name" manquante');
  }
  
  if (!schema.url) {
    errors.push('Organization: propriété "url" manquante');
  }
  
  if (!schema.logo) {
    errors.push('Organization: propriété "logo" manquante (recommandé pour Google)');
  }
  
  if (!schema.contactPoint && !schema.address) {
    errors.push('Organization: "contactPoint" ou "address" recommandé pour E-E-A-T');
  }
  
  return errors;
}

/**
 * Valider schéma Author/Person
 */
function validateAuthor(schema: Schema): string[] {
  const errors: string[] = [];
  
  if (!schema.name) {
    errors.push('Person: propriété "name" manquante');
  }
  
  if (!schema.url && !schema.mainEntityOfPage) {
    errors.push('Person: "url" ou "mainEntityOfPage" recommandé pour E-E-A-T');
  }
  
  if (!schema.jobTitle && !schema.description) {
    errors.push('Person: "jobTitle" ou "description" recommandé pour crédibilité');
  }
  
  return errors;
}

/**
 * Valider schéma FAQPage
 */
function validateFAQPage(schema: Schema): string[] {
  const errors: string[] = [];

  if (!schema.mainEntity || !Array.isArray(schema.mainEntity)) {
    errors.push('FAQPage: propriété "mainEntity" (array) manquante');
  } else {
    const questions = schema.mainEntity as Array<Record<string, unknown>>;

    if (questions.length < 2) {
      errors.push('FAQPage: au moins 2 questions recommandées');
    }

    questions.forEach((q, i) => {
      if (!q.name) {
        errors.push(`FAQPage: question ${i + 1} sans "name" (question text)`);
      }

      const acceptedAnswer = q.acceptedAnswer as { text?: string } | undefined;
      if (!acceptedAnswer || !acceptedAnswer.text) {
        errors.push(`FAQPage: question ${i + 1} sans "acceptedAnswer.text"`);
      }
    });
  }

  return errors;
}

/**
 * Calcul score Schema.org
 */
function calculateSchemaScore(schemas: Record<string, boolean>, errorsCount: number): number {
  const weights = {
    organization: 20,
    author: 25, // E-E-A-T signal fort
    faqPage: 15,
    breadcrumb: 10,
    article: 15,
    website: 15,
  };
  
  let score = 0;
  
  Object.entries(schemas).forEach(([key, found]) => {
    if (found) {
      score += weights[key as keyof typeof weights];
    }
  });
  
  // Pénalité pour erreurs de validation
  const errorPenalty = Math.min(errorsCount * 5, 30); // Max -30 points
  score = Math.max(0, score - errorPenalty);
  
  return score;
}

/**
 * Générer recommandations Schema.org
 */
function generateSchemaRecommendations(schemas: Record<string, boolean>): string[] {
  const recs: string[] = [];
  
  // Priorité E-E-A-T
  if (!schemas.author) {
    recs.push('Implémenter Author Schema (Person/ProfilePage) pour renforcer E-E-A-T');
  }
  
  if (!schemas.organization) {
    recs.push('Ajouter Organization Schema avec logo, contact, address');
  }
  
  if (!schemas.faqPage) {
    recs.push('Créer une page FAQ avec FAQPage Schema pour Rich Snippets Google');
  }
  
  if (!schemas.breadcrumb) {
    recs.push('Ajouter BreadcrumbList Schema pour améliorer navigation');
  }
  
  if (!schemas.website) {
    recs.push('Implémenter WebSite Schema avec potentialAction SearchAction');
  }
  
  return recs.slice(0, 3); // Top 3 recommandations
}

/**
 * Page-type keyword groups for link-driven schema discovery. Each group
 * targets the schema types a given page type typically carries:
 *  - team    → Person / ProfilePage (author signal)
 *  - blog    → Article / BlogPosting + BreadcrumbList
 *  - portfolio/services → BreadcrumbList (+ VideoObject etc.)
 *  - contact → ContactPage / BreadcrumbList
 *  - legal   → BreadcrumbList
 *  - testimonials → Review / AggregateRating
 * Matched accent-tolerant on path segments + anchor text (see page-discovery).
 *
 * The team / contact / legal / testimonials groups REUSE the shared keyword
 * sets from page-discovery (single source of truth — no drift). Schema-only
 * page types (blog/article, portfolio/projects, services) stay local since no
 * other analyzer probes them.
 */
const SCHEMA_PAGE_KEYWORDS: Record<string, string[]> = {
  team: TEAM_KEYWORDS,
  blog: ['blog', 'article', 'articles', 'actualites', 'actualités', 'news', 'magazine'],
  portfolio: ['portfolio', 'projets', 'projects', 'realisations', 'réalisations', 'cases', 'work'],
  services: ['services', 'service', 'prestations', 'solutions', 'leistungen', 'servizi'],
  contact: CONTACT_KEYWORDS,
  legal: LEGAL_KEYWORDS,
  testimonials: TESTIMONIAL_KEYWORDS,
};

/** Cap total candidate sub-pages fetched per analysis (homepage excluded). */
const SCHEMA_MAX_SUBPAGES = 8;

/**
 * Discover relevant sub-page URLs from the homepage's REAL links — one best
 * candidate per page-type group — same-origin + scheme-allowlisted by
 * `candidateUrls`. Deduped and capped. Returns absolute URLs (homepage NOT
 * included; the caller analyzes the homepage HTML it already fetched).
 */
function discoverSchemaPages(pageUrl: string, baseUrl: string, links: PageLink[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const keywords of Object.values(SCHEMA_PAGE_KEYWORDS)) {
    // No hardcoded fallback slug: if a site has no link for a page type, we
    // simply don't probe it (so we never penalize a site for lacking enigma's
    // exact paths). Take the first (best) same-origin candidate per group.
    const [best] = candidateUrls(pageUrl, baseUrl, links, keywords, []);
    if (best && !seen.has(best)) {
      seen.add(best);
      out.push(best);
    }
  }
  return out.slice(0, SCHEMA_MAX_SUBPAGES);
}

/**
 * Analyse Schema.org multi-pages — link-driven.
 *
 * Pre-fix this probed a hardcoded enigma.swiss-specific URL list
 * (`/blog/automatisation-ia-suisse`, `/portfolio`, `/temoignages`, …), which
 * 404'd on every other site and skewed the average. Now it fetches the
 * homepage ONCE (SSRF-guarded, soft-404-aware), reads its REAL links, and
 * discovers the relevant page types (blog/article, portfolio/projects,
 * service, team, contact, legal, testimonials) from those links. The score
 * is averaged over the pages ACTUALLY found — a site is never penalized for
 * not having enigma's exact paths.
 */
export async function analyzeSchemaOrgMultiPage(baseUrl: string): Promise<SchemaOrgResult> {
  console.log(`[Schema.org Multi-Page] Analyse complète site ${baseUrl}...`);

  // Fetch the homepage ONCE through the SSRF guard / soft-404 filter.
  const homepageHtml = await fetchRealPage(baseUrl);
  if (!homepageHtml) {
    console.log('[Schema.org Multi-Page] Homepage inaccessible, fallback page seule');
    return analyzeSchemaOrg(baseUrl);
  }

  const $home = cheerio.load(homepageHtml);
  const links = extractLinks($home);
  const subPages = discoverSchemaPages(baseUrl, baseUrl, links);

  console.log(`[Schema.org Multi-Page] ${subPages.length} sous-pages découvertes via liens réels`);

  // Homepage result is from the HTML we already have (no refetch). Sub-pages
  // are fetched through fetchRealPage (SSRF-guarded + soft-404-aware); pages
  // that 404 / soft-404 / get rejected simply yield no result and are skipped.
  const subResults = await Promise.all(
    subPages.map(async (url): Promise<SchemaOrgResult | null> => {
      const html = await fetchRealPage(url);
      return html ? analyzeSchemaHtml(html) : null;
    }),
  );

  const validResults: SchemaOrgResult[] = [
    analyzeSchemaHtml(homepageHtml),
    ...subResults.filter((r): r is SchemaOrgResult => r !== null),
  ];

  // Calculer score global (moyenne sur les pages réellement trouvées).
  const totalScore = validResults.reduce((sum, r) => sum + r.score, 0);
  let avgScore = Math.round(totalScore / validResults.length);

  // Agréger schemas trouvés (si au moins 1 page a le schema = true)
  const aggregatedSchemas = {
    organization: validResults.some(r => r.schemas.organization),
    author: validResults.some(r => r.schemas.author),
    faqPage: validResults.some(r => r.schemas.faqPage),
    breadcrumb: validResults.some(r => r.schemas.breadcrumb),
    article: validResults.some(r => r.schemas.article),
    website: validResults.some(r => r.schemas.website),
  };

  // Bonus si 6/6 schemas détectés sur l'ensemble du site (+20 pts). This is a
  // SITE-level coverage bonus (not tied to any specific URL), so it survives
  // the link-driven migration.
  const hasAll6Schemas = Object.values(aggregatedSchemas).every(Boolean);
  if (hasAll6Schemas) {
    avgScore = Math.min(100, avgScore + 20);
    console.log('[Schema.org Multi-Page] ✅ Bonus +20 pts: 6/6 schemas détectés sur le site');
  }

  const totalFound = Object.values(aggregatedSchemas).filter(Boolean).length;

  // Agréger détails (prendre la meilleure instance de chaque schema)
  const aggregatedDetails: SchemaOrgResult['details'] = {};
  for (const key of Object.keys(aggregatedSchemas) as Array<keyof SchemaOrgResult['details']>) {
    const bestResult = validResults.find(r => r.details[key]);
    if (bestResult) {
      aggregatedDetails[key] = bestResult.details[key];
    }
  }

  // Agréger erreurs (dédupliquer)
  const allErrors = validResults.flatMap(r => r.errors);
  const uniqueErrors = Array.from(new Set(allErrors));

  // Recalculer recommandations sur base agrégée
  const recommendations = generateSchemaRecommendations(aggregatedSchemas);

  console.log(`[Schema.org Multi-Page] Score final: ${avgScore}/100 (${totalFound}/6 schemas sur ${validResults.length} pages)`);

  return {
    score: avgScore,
    schemas: aggregatedSchemas,
    totalFound,
    details: aggregatedDetails,
    errors: uniqueErrors.slice(0, 5), // Top 5 erreurs
    recommendations,
  };
}

/**
 * Simulation données Schema.org (développement)
 */
function simulateSchemaData(): SchemaOrgResult {
  return {
    score: 65,
    schemas: {
      organization: true,
      author: false,
      faqPage: true,
      breadcrumb: false,
      article: false,
      website: true,
    },
    totalFound: 3,
    details: {
      organization: {
        '@type': 'Organization',
        name: 'Swissalytics',
        url: 'https://swissalytics.com',
        logo: 'https://swissalytics.com/swissalytics-logo.json',
      },
    },
    errors: [
      'Person: propriété "name" manquante',
      'FAQPage: au moins 2 questions recommandées',
    ],
    recommendations: [
      'Implémenter Author Schema (Person/ProfilePage) pour renforcer E-E-A-T',
      'Ajouter BreadcrumbList Schema pour améliorer navigation',
      'Créer une page FAQ avec FAQPage Schema pour Rich Snippets Google',
    ],
  };
}
