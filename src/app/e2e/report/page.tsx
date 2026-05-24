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
    images: [],
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
    ],
    external: [
      { href: 'https://example.com', text: 'Exemple', isNofollow: true, isSponsored: false, isUgc: false, isExternal: true },
    ],
    nofollow: 5,
    dofollow: 29,
    emptyAnchors: 0,
    genericAnchors: 2,
    withImages: 3,
    uniqueAnchors: 30,
    brokenLinks: [],
    internalBrokenLinks: [],
    issues: [
      { type: 'info', message: '2 ancres génériques ("cliquez ici") détectées' },
    ],
  },
  technical: {
    score: 68,
    robotsTxt: { exists: true, content: 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /' },
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
    longestSentences: [],
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
          teamPage: { found: true },
          legalMentions: true,
          contactPage: { found: true },
          testimonials: { found: false, count: 0 },
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

export default function E2EReportPage() {
  // Guard: in production without E2E=1, return 404.
  if (process.env.NODE_ENV === 'production' && process.env.E2E !== '1') {
    notFound();
  }
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ReportView report={FIXTURE} />
    </Suspense>
  );
}
