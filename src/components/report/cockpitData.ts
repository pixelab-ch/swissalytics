/**
 * cockpitData — pure, React-free helpers for the cockpit/overview dashboard.
 *
 * Extracted from OverviewContent.tsx so the credibility-sensitive logic
 * (which engines "cite you", which signals are genuine strengths) is unit
 * testable and isn't conflated with rendering. NO React imports here.
 */

import type { AnalysisResult } from '@/lib/types';
import type { GeoIndexationEngineResult } from '@/lib/analyzers/types';
import type { Effort } from '@/lib/engine/plan';

/** Canonical 4 engines shown in the cockpit, in display order. */
export const COCKPIT_ENGINES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude', label: 'Claude' },
  { id: 'mistral', label: 'Mistral' },
];

type Engines = Record<string, GeoIndexationEngineResult>;

/**
 * Resolve the honest display state of a single engine. Critically distinguishes
 * "the LLM call errored / was never run" from "the engine genuinely does not
 * cite this site" — conflating these is a false credibility claim.
 *
 *  - 'untested'    → engines[id] is absent (never tested / region-filtered)
 *  - 'error'       → engines[id].error is truthy (upstream API failure)
 *  - 'indexed'     → present, no error, indexed === true
 *  - 'not-indexed' → present, no error, indexed === false
 */
export function engineState(
  engines: Engines,
  id: string,
): 'untested' | 'error' | 'indexed' | 'not-indexed' {
  const e = engines[id];
  if (!e) return 'untested';
  if (e.error) return 'error';
  return e.indexed ? 'indexed' : 'not-indexed';
}

/**
 * Headline counts for "X / N moteurs te citent":
 *  - cited  = engines in 'indexed' state
 *  - tested = engines actually exercised without error (indexed OR not-indexed)
 *
 * Errored and untested engines are excluded from BOTH numerator and
 * denominator so the headline never misreports availability as a no-cite.
 */
export function citedTestedCounts(
  engines: Engines,
  canonical: ReadonlyArray<{ id: string }> = COCKPIT_ENGINES,
): { cited: number; tested: number } {
  let cited = 0;
  let tested = 0;
  for (const { id } of canonical) {
    const state = engineState(engines, id);
    if (state === 'indexed') {
      cited += 1;
      tested += 1;
    } else if (state === 'not-indexed') {
      tested += 1;
    }
    // 'error' and 'untested' contribute to neither.
  }
  return { cited, tested };
}

/** A genuine positive signal, localized. */
export interface Strength {
  key: string;
  fr: string;
  en: string;
}

/**
 * Pick the positive signals that are actually TRUE from the report data.
 * Synchronous strengths come from the always-present AnalysisResult fields;
 * the LCP strength is handled separately in the view (async, needs a skeleton).
 *
 * Returns localized {fr,en} so the view picks the active language without
 * re-deriving the thresholds.
 */
export function buildStrengths(report: AnalysisResult): Strength[] {
  const out: Strength[] = [];

  // HTTPS active + no mixed content.
  if (report.technical.isHttps && report.technical.mixedContentCount === 0) {
    out.push({
      key: 'https',
      fr: 'HTTPS actif, aucun contenu mixte.',
      en: 'HTTPS active, no mixed content.',
    });
  }

  // Schema Organization / WebSite present (synchronous, from metadata).
  const types = report.metadata.structuredData.types ?? [];
  const hasOrg = types.some((t) => /organization/i.test(t));
  const hasSite = types.some((t) => /website/i.test(t));
  if (hasOrg || hasSite) {
    const both = hasOrg && hasSite;
    const lead = both
      ? 'Schema Organization + WebSite'
      : hasOrg
      ? 'Schema Organization'
      : 'Schema WebSite';
    out.push({
      key: 'schema',
      fr: `${lead} détecté.`,
      en: `${lead} detected.`,
    });
  }

  // Alt-text ratio (only when most images have alt → genuinely a strength).
  if (report.images.total > 0 && report.images.withAlt >= report.images.total * 0.75) {
    out.push({
      key: 'alt',
      fr: `${report.images.withAlt} / ${report.images.total} images ont un texte alternatif.`,
      en: `${report.images.withAlt} / ${report.images.total} images have alt text.`,
    });
  }

  // Flesch readability (≥ 60 = readable for a general audience).
  if (report.readability.fleschScore >= 60) {
    const score = Math.round(report.readability.fleschScore);
    out.push({
      key: 'flesch',
      fr: `Lisibilité Flesch ${score} — correcte pour le grand public.`,
      en: `Flesch readability ${score} — readable for a general audience.`,
    });
  }

  return out;
}

/** Read LCP (mobile preferred) in ms; null when CWV data isn't here yet. */
export function lcpMs(report: AnalysisResult): number | null {
  const cwv = report.technical.coreWebVitals;
  const lcp = cwv?.mobile?.lcp ?? cwv?.desktop?.lcp;
  return typeof lcp === 'number' ? lcp : null;
}

/**
 * Map the bare S/M/L effort code to an explicit localized phrase. The raw
 * letters were unreadable on their own; users see "Effort faible/moyen/élevé"
 * (FR) or "Low/Medium/High effort" (EN).
 */
export function effortLabel(effort: Effort, isFr: boolean): string {
  if (isFr) {
    return effort === 'S'
      ? 'Effort faible'
      : effort === 'L'
      ? 'Effort élevé'
      : 'Effort moyen';
  }
  return effort === 'S'
    ? 'Low effort'
    : effort === 'L'
    ? 'High effort'
    : 'Medium effort';
}
