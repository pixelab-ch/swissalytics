/**
 * E2E FIXTURE ROUTE — NOT a real user-facing page.
 *
 * Renders <ReportView> with a static fixture AnalysisResult so Playwright
 * tests can assert on the rendered report UI without hitting the live
 * analyze API or the database.
 *
 * Guard: in production (NODE_ENV=production without E2E=1) this returns 404.
 * The playwright webServer command sets E2E=1 env var so the guard lets
 * Playwright through. force-dynamic ensures the guard runs at request time
 * (not baked into the static build).
 */
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ReportView from '@/components/report/ReportView';
import type { AnalysisResult } from '@/lib/types';

interface E2EReportPageProps {
  searchParams?: Promise<{ state?: string }>;
}

/** Minimal but realistic AnalysisResult fixture covering all e2e assertions. */
const FIXTURE: AnalysisResult = {
  url: 'https://e2e-fixture.swissalytics.test',
  timestamp: '2026-05-24T10:00:00.000Z',
  score: 62,
  keywords: {
    keywords: [
      { word: 'analyse', count: 12 },
      { word: 'seo', count: 8 },
    ],
    placement: {
      primary: 'analyse',
      inTitle: true,
      inH1: true,
      inMetaDescription: true,
      inFirst100Words: true,
      density: 1.8,
      densityStatus: 'optimal',
      totalWords: 650,
      keywordCount: 12,
    },
    targets: [
      { word: 'analyse', score: 0.9, inTitle: true, inH1: true, inMetaDescription: true, inFirst100Words: true },
      { word: 'seo', score: 0.7, inTitle: false, inH1: false, inMetaDescription: true, inFirst100Words: true },
    ],
    issues: [
      { type: 'warning', message: 'Densité de mot-clé légèrement élevée' },
    ],
  },
  headings: {
    score: 71,
    title: { content: 'Analyse SEO — Swissalytics Test', length: 34, isOptimal: true },
    metaDescription: { content: 'Analyse SEO et GEO complète pour votre site.', length: 46, isOptimal: true },
    h1: ['Analyse SEO complète'],
    h2: ['Performance technique', 'Contenu et lisibilité', 'Indexation IA'],
    h3: ['Core Web Vitals', 'Mots-clés cibles'],
    h4: [],
    h5: [],
    h6: [],
    issues: [
      { type: 'error', message: 'Balise H1 manquante sur 2 pages liées' },
      { type: 'warning', message: 'Structure H2 non optimale' },
    ],
  },
  images: {
    score: 55,
    total: 18,
    withAlt: 10,
    withoutAlt: 8,
    withoutResponsive: 4,
    images: [
      {
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='140'%3E%3Crect width='240' height='140' fill='%23E5241A'/%3E%3C/svg%3E",
        alt: 'Bannière promotionnelle rouge',
        hasAlt: true,
        width: '240',
        height: '140',
        isLazy: true,
        format: 'svg',
        hasSrcset: false,
      },
      {
        src: 'https://e2e-fixture.swissalytics.test/assets/media/very/deep/path/hero-banner-2400x1600-final-v3-compressed.jpg',
        alt: '',
        hasAlt: false,
        width: '2400',
        height: '1600',
        isLazy: false,
        format: 'jpg',
        hasSrcset: false,
      },
    ],
    issues: [
      { type: 'error', message: '8 images sans attribut alt (accessibilité et SEO)' },
      { type: 'warning', message: '4 images sans attribut srcset (responsive)' },
    ],
  },
  links: {
    score: 80,
    total: 34,
    internal: [
      { href: '/page-1', text: 'Page 1', isNofollow: false, isSponsored: false, isUgc: false, isExternal: false },
      { href: '/page-2', text: 'Page 2', isNofollow: false, isSponsored: false, isUgc: false, isExternal: false },
      // Long URLs + long anchor texts exercise the table truncation / no-inner-scroll behaviour.
      { href: '/blog/2026/05/comment-optimiser-le-referencement-naturel-et-la-visibilite-dans-les-moteurs-ia-en-suisse-romande', text: 'Comment optimiser le référencement naturel et la visibilité dans les moteurs IA en Suisse romande pour 2026', isNofollow: false, isSponsored: false, isUgc: false, isExternal: false },
      { href: '/categories/services/audit-seo-technique-complet-avec-recommandations-actionnables-et-priorisees-par-impact', text: 'Audit SEO technique complet avec recommandations actionnables et priorisées par impact business mesurable', isNofollow: false, isSponsored: false, isUgc: false, isExternal: false },
    ],
    external: [
      { href: 'https://example.com', text: 'Exemple', isNofollow: true, isSponsored: false, isUgc: false, isExternal: true },
      { href: 'https://www.un-domaine-externe-tres-long.example.com/chemin/vers/une/ressource/profondement/imbriquee/avec/parametres?utm_source=swissalytics&utm_medium=referral&utm_campaign=audit', text: 'Lien externe avec une URL extrêmement longue et un texte d’ancrage qui dépasse largement la largeur de la colonne', isNofollow: false, isSponsored: true, isUgc: false, isExternal: true },
    ],
    nofollow: 5,
    dofollow: 29,
    emptyAnchors: 0,
    genericAnchors: 2,
    withImages: 3,
    uniqueAnchors: 30,
    brokenLinks: [
      { href: 'https://example.com/ancienne-page-supprimee/avec-une-url-tres-longue-sans-aucun-espace-pour-tester-le-retour-a-la-ligne', status: 404 },
    ],
    internalBrokenLinks: [
      { href: '/ressources/document-introuvable-au-chemin-particulierement-profond-et-long-qui-ne-rentre-pas-sur-une-ligne', status: 500 },
    ],
    issues: [
      { type: 'info', message: '2 ancres génériques ("cliquez ici") détectées' },
    ],
  },
  technical: {
    score: 68,
    robotsTxt: {
      exists: true,
      // Long, realistic robots.txt so the viewer expands in-page (no inner
      // vertical scroll) and long Disallow paths wrap (no inner horizontal scroll).
      content: [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin/',
        'Disallow: /wp-admin/',
        'Disallow: /cart/',
        'Disallow: /checkout/',
        'Disallow: /account/',
        'Disallow: /search?',
        'Disallow: /*?utm_source=',
        'Disallow: /private/un-chemin-tres-long-qui-ne-contient-aucun-espace-et-pourrait-provoquer-un-debordement-horizontal-sans-word-break/',
        '',
        'User-agent: GPTBot',
        'Disallow: /',
        '',
        'User-agent: CCBot',
        'Disallow: /',
        '',
        'User-agent: ClaudeBot',
        'Allow: /',
        '',
        'User-agent: PerplexityBot',
        'Allow: /blog/',
        'Disallow: /',
        '',
        'User-agent: Google-Extended',
        'Allow: /',
        '',
        'Sitemap: https://e2e-fixture.swissalytics.test/sitemap.xml',
        'Sitemap: https://e2e-fixture.swissalytics.test/sitemap-blog.xml',
        'Sitemap: https://e2e-fixture.swissalytics.test/sitemap-products.xml',
      ].join('\n'),
    },
    sitemap: { exists: true, url: 'https://e2e-fixture.swissalytics.test/sitemap.xml', inRobots: true },
    llmsTxt: { exists: false },
    canonical: 'https://e2e-fixture.swissalytics.test/',
    lang: 'fr',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'UTF-8',
    cms: 'Next.js',
    technologies: ['Next.js', 'Tailwind CSS', 'Vercel'],
    htmlSize: 42000,
    isHttps: true,
    mixedContentCount: 0,
    accessibility: {
      missingFormLabels: 0,
      missingButtonLabels: 1,
      hasSkipNav: false,
      hasLangAttribute: true,
    },
    cssAnalysis: { total: 3, inline: 0, local: 1, external: 2 },
    jsAnalysis: { total: 5, inline: 1, local: 2, external: 2, blocking: 1 },
    urlStructure: {
      length: 38,
      hasUnderscores: false,
      hasUppercase: false,
      hasSpecialChars: false,
      depth: 1,
      keywordInUrl: false,
    },
    resourceHints: { preconnect: 2, preload: 1, prefetch: 0, dnsPrefetch: 1 },
    httpHeaders: {
      xRobotsTag: null,
      cacheControl: 'max-age=3600',
      contentSecurityPolicy: true,
      strictTransportSecurity: true,
    },
    manifest: { exists: false },
    /** Fast LCP (1800ms ≤ 2500ms) so the cockpit "LCP rapide" strength renders. */
    coreWebVitals: {
      mobile: { performance: 82, fcp: 1200, lcp: 1800, cls: 0.04, tbt: 90, si: 2100 },
      desktop: { performance: 95, fcp: 700, lcp: 1100, cls: 0.02, tbt: 30, si: 1200 },
    },
    /** Mix: GPTBot blocked, CCBot blocked, others unmentioned/allowed */
    botCoverage: [
      { name: 'Googlebot', status: 'allowed' },
      { name: 'GPTBot', status: 'blocked' },
      { name: 'ClaudeBot', status: 'unmentioned' },
      { name: 'PerplexityBot', status: 'unmentioned' },
      { name: 'Google-Extended', status: 'unmentioned' },
      { name: 'CCBot', status: 'blocked' },
    ],
    issues: [
      { type: 'error', message: 'JavaScript bloquant détecté (render-blocking)' },
      { type: 'warning', message: 'Fichier llms.txt absent (bonus optionnel — non requis par Google)' },
      { type: 'info', message: 'CMS détecté : Next.js' },
    ],
  },
  metadata: {
    score: 75,
    ogTitle: 'Analyse SEO — Swissalytics Test',
    ogDescription: 'Analyse SEO et GEO pour votre site web.',
    ogImage: 'https://e2e-fixture.swissalytics.test/og.png',
    ogUrl: 'https://e2e-fixture.swissalytics.test/',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Analyse SEO — Swissalytics Test',
    twitterDescription: 'Analyse SEO et GEO pour votre site web.',
    twitterImage: 'https://e2e-fixture.swissalytics.test/og.png',
    favicon: '/favicon.ico',
    robots: 'index, follow',
    hreflang: [{ lang: 'fr', href: 'https://e2e-fixture.swissalytics.test/' }],
    structuredData: { exists: true, types: ['Organization', 'WebSite'] },
    eeat: {
      hasAuthor: true,
      authorName: 'Équipe Pixelab',
      hasPublishedDate: true,
      publishedDate: '2025-11-01',
      hasModifiedDate: false,
      modifiedDate: null,
      hasContactLink: true,
      hasPrivacyPolicy: true,
      hasTermsOfService: false,
      signalCount: 5,
    },
    duplicates: { titleCount: 1, descriptionCount: 1, titleMatchesOg: true },
    issues: [
      { type: 'warning', message: 'Date de modification absente du Schema.org' },
    ],
  },
  readability: {
    score: 63,
    wordCount: 650,
    sentenceCount: 42,
    paragraphCount: 12,
    avgWordsPerSentence: 15.5,
    readingTime: 3,
    fleschScore: 58,
    fleschLevel: 'Standard',
    distribution: { veryShort: 4, short: 10, medium: 18, long: 8, veryLong: 2 },
    longestSentences: [
      { text: 'L’optimisation pour les moteurs de recherche traditionnels et pour les moteurs génératifs IA repose sur une architecture de contenu rigoureuse, des données structurées Schema.org cohérentes, et une stratégie de maillage interne qui rend chaque page facilement accessible aux robots d’indexation comme aux modèles de langage.', wordCount: 42, charCount: 312 },
      { text: 'Lorsque vous publiez un article de fond, veillez à inclure une date de publication et une date de modification visibles, un auteur clairement identifié avec ses références, ainsi que des sources externes fiables qui renforcent l’autorité perçue de votre contenu auprès des moteurs IA.', wordCount: 38, charCount: 285 },
      { text: 'Les phrases trop longues nuisent à la lisibilité et au score Flesch, il est donc recommandé de les fractionner en propositions plus courtes pour améliorer la compréhension du lecteur humain et le découpage sémantique opéré par les modèles génératifs.', wordCount: 35, charCount: 251 },
    ],
    tips: ['Réduire les phrases longues (>30 mots)', 'Ajouter des sous-titres H3'],
    issues: [
      { type: 'info', message: 'Score Flesch correct (58) — lisible pour un public général' },
    ],
  },
  /** Full geoAnalysis so the IA-Ready scorecard is not in loading state */
  geoAnalysis: {
    url: 'https://e2e-fixture.swissalytics.test',
    timestamp: '2026-05-24T10:00:05.000Z',
    globalScore: 61,
    category: 'Bon',
    seo: {
      score: 72,
      breakdown: { lighthouse: 80, technicalSEO: 68, content: 65 },
      lighthouse: { performance: 82, accessibility: 88, bestPractices: 92, seo: 90 },
    },
    geo: {
      score: 58,
      breakdown: { indexation: 55, schema: 65, eeat: 55 },
      indexation: {
        score: 55,
        totalIndexed: 2,
        totalEnabled: 5,
        region: 'CH',
        engines: {
          gemini: { indexed: true, confidence: 'high', mentions: 3 },
          chatgpt: { indexed: false, confidence: 'low', mentions: 0 },
          claude: { indexed: true, confidence: 'medium', mentions: 2 },
          mistral: { indexed: false, confidence: 'low', mentions: 0 },
          perplexity: { indexed: false, confidence: 'low', mentions: 0 },
        },
      },
      schema: {
        score: 65,
        totalFound: 2,
        schemas: {
          organization: true,
          author: false,
          faqPage: false,
          breadcrumb: false,
          article: false,
          website: true,
        },
      },
      eeat: {
        score: 55,
        signals: {
          teamPage:      { found: true,  state: 'present' },
          legalMentions: { found: false, state: 'unverified' },
          contactPage:   { found: true,  state: 'present' },
          testimonials:  { found: false, state: 'absent', count: 0 },
        },
      },
    },
    recommendations: [
      {
        priority: 'critical',
        title: 'Ajouter Schema.org LocalBusiness',
        description: 'Marquer votre établissement avec un schéma LocalBusiness améliore la reconnaissance par les LLMs.',
        impact: 9,
        difficulty: 'medium',
        category: 'geo',
        timeframe: '1 semaine',
      },
      {
        priority: 'high',
        title: 'Améliorer la structure E-E-A-T',
        description: 'Ajouter une page Équipe et des témoignages renforce la confiance des LLMs.',
        impact: 7,
        difficulty: 'medium',
        category: 'geo',
        timeframe: '2 semaines',
      },
      {
        priority: 'medium',
        title: 'Ajouter des breadcrumbs Schema.org',
        description: 'Les breadcrumbs améliorent la navigation et la compréhension de la structure du site.',
        impact: 5,
        difficulty: 'low',
        category: 'seo',
        timeframe: '3 jours',
      },
    ],
    projection: {
      threeMonths: {
        estimatedScore: 72,
        gain: 11,
        quickWins: ['Schema LocalBusiness', 'Breadcrumbs'],
        requiredActions: ['Page Équipe', 'Témoignages'],
      },
      sixMonths: {
        estimatedScore: 80,
        gain: 19,
        quickWins: [],
        requiredActions: ['Contenu expert', 'Backlinks qualifiés'],
      },
    },
  },
};

export default async function E2EReportPage({ searchParams }: E2EReportPageProps) {
  // Guard: in production without E2E=1, return 404.
  if (process.env.NODE_ENV === 'production' && process.env.E2E !== '1') {
    notFound();
  }

  const resolved = await searchParams;
  const state = resolved?.state;
  const loading = state === 'loading';
  // ?state=geo-failed simulates a TERMINAL geo-fetch failure: the async
  // fetchGeo() resolved with null (HTTP error/timeout/bad JSON), so geoLoading
  // flipped back to false WITHOUT geoAnalysis ever arriving. The cockpit §02
  // must show the "Moteurs IA indisponibles" degraded state — NOT a skeleton
  // that animates forever.
  const geoFailed = state === 'geo-failed';
  // ?state=engine-mix exercises the honest per-engine states: one indexed,
  // one not-indexed, one errored (LLM call failed), one untested (absent).
  const engineMix = state === 'engine-mix';

  let report: AnalysisResult;
  if (loading) {
    // The moment right after /analyze when async payloads haven't arrived yet,
    // so the cockpit renders its calm skeletons (geoLoading + cwvLoading true).
    report = {
      ...FIXTURE,
      geoAnalysis: undefined,
      technical: { ...FIXTURE.technical, coreWebVitals: undefined },
    };
  } else if (geoFailed) {
    report = { ...FIXTURE, geoAnalysis: undefined };
  } else if (engineMix) {
    report = {
      ...FIXTURE,
      geoAnalysis: {
        ...FIXTURE.geoAnalysis!,
        geo: {
          ...FIXTURE.geoAnalysis!.geo,
          indexation: {
            ...FIXTURE.geoAnalysis!.geo.indexation,
            engines: {
              // chatgpt: errored (LLM call failed) — must NOT render red ✗
              chatgpt: { indexed: false, confidence: 'none', mentions: 0, error: 'HTTP 404 model deprecated' },
              // gemini: genuinely indexed
              gemini: { indexed: true, confidence: 'high', mentions: 3 },
              // claude: genuinely not indexed
              claude: { indexed: false, confidence: 'low', mentions: 0 },
              // mistral: absent → untested
            },
          },
        },
      },
    };
  } else {
    report = FIXTURE;
  }

  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ReportView report={report} cwvLoading={loading} geoLoading={loading} />
    </Suspense>
  );
}
