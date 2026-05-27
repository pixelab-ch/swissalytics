import { NextRequest, NextResponse } from 'next/server';
import { validateUrl } from '@/lib/security';
import { hasRecentAdmission, getClientIp } from '@/lib/security/rateLimit';
import { runLighthouseAudit } from '@/lib/analyzers/lighthouse';
import { analyzeSEO } from '@/lib/analyzers/seo';
import { analyzeGEOIndexation } from '@/lib/analyzers/geo-indexation';
import { analyzeSchemaOrgMultiPage } from '@/lib/analyzers/schema-org';
import { analyzeEEAT } from '@/lib/analyzers/eeat';
import { buildPageContext } from '@/lib/analyzers/page-discovery';
import { calculateCompositeScore } from '@/lib/analyzers/composite-score';
import {
  withTimeout,
  resolveOrFallback,
  lighthouseFallback,
  seoFallback,
  geoIndexationFallback,
  schemaOrgFallback,
  eeatFallback,
  isAnyDegraded,
  type DegradedFlags,
} from '@/lib/analyzers/resilience';
import type { GeoAnalysisResult } from '@/lib/analyzers/types';

/**
 * Per-analyzer timeouts (P8.2 → P15 tuning). Lighthouse calls Google
 * PageSpeed which routinely takes 20-30s on a cold cache (esp. mobile
 * + opaque sites) — 15s was clipping legit responses, leading to
 * systematic "lighthouse timeout" degraded flags in prod. The
 * PAGESPEED_TIMEOUT_MS in the client is 30s, so we align the wrapper
 * at 35s (5s slack for our own overhead).
 *
 * GEO indexation fires N LLM API calls (Gemini, ChatGPT, Claude, …)
 * sequentially per registry order; each can take 5-10s on its own.
 * 5s was killing the whole tile before any provider could answer —
 * 25s gives breathing room for 2-3 LLMs to respond.
 *
 * SEO stays short — it's local cheerio; if it takes >5s something is
 * wrong with the target site.
 *
 * Schema uses `analyzeSchemaOrgMultiPage` which reuses the SHARED
 * homepage PageContext (fetched once upstream) then fetches up to 8
 * sub-pages in parallel (each capped ~8s by FETCH_TIMEOUT_MS, fetched
 * concurrently via fetchFirstAvailable so the wall ≈ one timeout) —
 * worst-case ~8s on a slow CMS. 5s was clipping legit sites. 12s
 * matches the EEAT budget for the identical sub-page-fetch pattern.
 * Analyzers run in parallel via Promise.allSettled so the budget hit
 * is not cumulative.
 *
 * EEAT (P-eeat) is link-driven: it reuses the SHARED homepage
 * PageContext (fetched once upstream), reads its real links, then fetches at
 * most one real candidate page per signal (team / contact / legal) instead of
 * probing ~10 guessed URLs. It also fetches each candidate end-to-end (GET +
 * soft-404 body check) on possibly slow CMS pages. 5s was clipping legit sites
 * (e.g. enigma.swiss, whose team page is `/fr/lequipe/`) and dropping the whole
 * tile to the all-missing fallback → bogus "create a team page" reco. 12s gives
 * the ≤3 candidate fetches room while staying well under the 25s overall geo
 * budget.
 */
const TIMEOUTS = {
  lighthouse: 35_000,
  seo: 5_000,
  geo: 25_000,
  schema: 12_000,
  eeat: 12_000,
} as const;

const CORS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://swissalytics.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  try {
    // P7.3 — unified rate limit. Enrichment endpoints don't consume
    // their own credits; they verify the IP has been admitted by a
    // recent /api/analyze call (within the past hour). Spammers
    // hitting /api/geo-analyze without a prior /api/analyze get 429.
    const clientIp = getClientIp(request);
    if (!hasRecentAdmission(clientIp)) {
      return NextResponse.json(
        { error: 'Aucune analyse récente détectée pour cette IP — lancez d\'abord une analyse via /api/analyze.' },
        { status: 429, headers: CORS }
      );
    }

    const body = await request.json();
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    // P18.B — pageContext was previously consumed here for keyword
    // suggestions ; that responsibility moved to /api/keyword-suggestions
    // so this endpoint is no longer LLM-dominated by the slowest analyzer.
    if (!rawUrl) {
      return NextResponse.json({ error: 'URL requise' }, { status: 400, headers: CORS });
    }

    let validatedUrl: string;
    try {
      const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Protocole non supporté');
      }
      validatedUrl = parsed.href;
    } catch {
      return NextResponse.json({ error: 'URL invalide' }, { status: 422, headers: CORS });
    }

    try {
      await validateUrl(validatedUrl);
    } catch {
      return NextResponse.json({ error: 'URL non autorisée' }, { status: 403, headers: CORS });
    }

    // Fetch + parse the homepage ONCE (guarded path) and share it across the
    // sub-analyzers that read the homepage (eeat + schema-org) instead of each
    // re-fetching it. Returns null when unreachable / soft-404 / SSRF-rejected
    // — each analyzer degrades exactly as it did when it self-fetched and got
    // null. SEO + GEO indexation are NOT given the context: SEO uses a distinct
    // unguarded fetch with throw-on-error semantics, and GEO indexation never
    // fetches the homepage (it only calls LLM APIs keyed on the domain).
    const pageContext = await buildPageContext(validatedUrl);

    // P8: Run all 5 analyzers in parallel with PER-ANALYZER timeouts
    // and fail-open via Promise.allSettled. A single rejection no
    // longer 500s the whole request — failed analyzers fall back to
    // safe defaults and the response carries a `degraded` flag block
    // so the UI can surface partial data clearly.
    const settled = await Promise.allSettled([
      withTimeout(runLighthouseAudit(validatedUrl),                   TIMEOUTS.lighthouse, 'lighthouse'),
      withTimeout(analyzeSEO(validatedUrl),                           TIMEOUTS.seo,        'seo'),
      withTimeout(analyzeGEOIndexation(validatedUrl),                 TIMEOUTS.geo,        'geo'),
      withTimeout(analyzeSchemaOrgMultiPage(validatedUrl, pageContext), TIMEOUTS.schema,   'schema'),
      withTimeout(analyzeEEAT(validatedUrl, pageContext),             TIMEOUTS.eeat,       'eeat'),
    ]);

    const degraded: DegradedFlags = { lighthouse: false, seo: false, geo: false, schema: false, eeat: false };
    const degradedReasons: Record<keyof DegradedFlags, string | undefined> = {
      lighthouse: undefined, seo: undefined, geo: undefined, schema: undefined, eeat: undefined,
    };

    const lighthouse = resolveOrFallback(settled[0], () => lighthouseFallback(degradedReasons.lighthouse ?? 'erreur inconnue'),
      (r) => { degraded.lighthouse = true; degradedReasons.lighthouse = r; });
    const seo    = resolveOrFallback(settled[1], seoFallback,           (r) => { degraded.seo    = true; degradedReasons.seo = r; });
    const geo    = resolveOrFallback(settled[2], geoIndexationFallback, (r) => { degraded.geo    = true; degradedReasons.geo = r; });
    const schema = resolveOrFallback(settled[3], schemaOrgFallback,     (r) => { degraded.schema = true; degradedReasons.schema = r; });
    const eeat   = resolveOrFallback(settled[4], eeatFallback,          (r) => { degraded.eeat   = true; degradedReasons.eeat = r; });

    if (isAnyDegraded(degraded)) {
      console.warn('[/api/geo-analyze] Degraded:',
        Object.entries(degraded).filter(([, v]) => v).map(([k]) => `${k}=${degradedReasons[k as keyof DegradedFlags]}`).join(' · ')
      );
    }

    const composite = calculateCompositeScore({ lighthouse, seo, geo, schema, eeat });

    const warnings: string[] = [];
    if (lighthouse.isEstimated) {
      warnings.push(lighthouse.warning || 'Scores Lighthouse estimés (pas de clé API Google PageSpeed)');
    }
    for (const [name, reason] of Object.entries(degradedReasons)) {
      if (reason) warnings.push(`${name} indisponible : ${reason}`);
    }

    const result: GeoAnalysisResult = {
      url: validatedUrl,
      timestamp: new Date().toISOString(),
      globalScore: composite.globalScore,
      category: composite.category,
      seo: {
        score: composite.seo.score,
        breakdown: composite.seo.breakdown,
        lighthouse: {
          performance: lighthouse.performance,
          accessibility: lighthouse.accessibility,
          bestPractices: lighthouse.bestPractices,
          seo: lighthouse.seo,
          isEstimated: lighthouse.isEstimated,
          warning: lighthouse.warning,
        },
      },
      geo: {
        score: composite.geo.score,
        breakdown: composite.geo.breakdown,
        indexation: {
          score: geo.score,
          totalIndexed: geo.totalIndexed,
          totalEnabled: geo.totalEnabled,
          region: geo.region,
          engines: geo.engines,
        },
        schema: {
          score: schema.score,
          totalFound: schema.totalFound,
          schemas: schema.schemas,
        },
        eeat: {
          score: eeat.score,
          signals: {
            teamPage:      { found: eeat.signals.teamPage.found,      state: eeat.signals.teamPage.state },
            legalMentions: { found: eeat.signals.legalMentions.found, state: eeat.signals.legalMentions.state },
            contactPage:   { found: eeat.signals.contactPage.found,   state: eeat.signals.contactPage.state },
            testimonials:  { found: eeat.signals.testimonials.found,  count: eeat.signals.testimonials.count, state: eeat.signals.testimonials.state },
          },
        },
      },
      recommendations: composite.topRecommendations.map(r => ({
        ...r,
        timeframe: r.timeframe as string,
      })),
      projection: composite.projection,
      warnings: warnings.length > 0 ? warnings : undefined,
      degraded: isAnyDegraded(degraded) ? degraded : undefined,
    };

    return NextResponse.json(result, { headers: CORS });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Erreur inattendue';
    console.error('[/api/geo-analyze]', rawMessage);
    const isTimeout = rawMessage.includes('Timeout');
    return NextResponse.json(
      { error: isTimeout ? 'Délai d\'attente dépassé — le site ne répond pas.' : 'Une erreur est survenue lors de l\'analyse. Veuillez réessayer.' },
      { status: isTimeout ? 504 : 500, headers: CORS }
    );
  }
}
