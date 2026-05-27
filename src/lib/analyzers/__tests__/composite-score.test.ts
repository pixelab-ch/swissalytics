import { describe, it, expect } from 'vitest';
import { calculateCompositeScore } from '../composite-score';
import { lighthouseFallback, seoFallback, geoIndexationFallback, schemaOrgFallback } from '../resilience';
import type { EEATResult } from '../eeat';
import type { SignalState } from '../page-discovery';

/**
 * Task 7 — composite-score reco suppression (Option B).
 *
 * Decision 3 (locked): ONLY recommend "create page" when state === 'absent'.
 * When state === 'unverified' the page may well exist (timeout/blocked) — do NOT nag.
 */

/** Base EEAT result — present team + testimonials, no reco triggers. */
function baseEeat(): EEATResult {
  return {
    score: 30,
    signals: {
      teamPage:    { found: false, state: 'absent', quality: 'none', authorsCount: 0 },
      legalMentions: { found: true, state: 'present' },
      contactPage: { found: true, state: 'present', hasEmail: true, hasPhone: false, hasAddress: false },
      testimonials: { found: false, state: 'absent', count: 0, hasSchema: false },
      backlinks:   { total: 10, quality: 'medium', domains: 5 },
      authorBios:  { found: false, count: 0 },
    },
    recommendations: [],
  };
}

function dataWithTeam(state: SignalState) {
  const eeat = baseEeat();
  eeat.signals.teamPage = { found: state === 'present', state, quality: 'none', authorsCount: 0 };
  // Suppress other recos that would pollute the check — make everything else "good"
  eeat.signals.testimonials = { found: true, state: 'present', count: 3, hasSchema: true };
  return {
    lighthouse: lighthouseFallback('test'),
    seo: seoFallback(),
    geo: geoIndexationFallback(),
    schema: schemaOrgFallback(),
    eeat,
  };
}

function dataWithTestimonials(state: SignalState) {
  const eeat = baseEeat();
  eeat.signals.testimonials = { found: state === 'present', state, count: 0, hasSchema: false };
  // Suppress team reco — team present
  eeat.signals.teamPage = { found: true, state: 'present', quality: 'high', authorsCount: 3 };
  return {
    lighthouse: lighthouseFallback('test'),
    seo: seoFallback(),
    geo: geoIndexationFallback(),
    schema: schemaOrgFallback(),
    eeat,
  };
}

describe('composite recommendations — unverified suppression (Option B)', () => {
  it('recommends "Créer page équipe" when teamPage.state === absent', () => {
    const recs = calculateCompositeScore(dataWithTeam('absent')).topRecommendations;
    expect(recs.some((r) => /page équipe/i.test(r.title))).toBe(true);
  });

  it('does NOT recommend creating a team page when teamPage.state === unverified', () => {
    const recs = calculateCompositeScore(dataWithTeam('unverified')).topRecommendations;
    expect(recs.some((r) => /page équipe/i.test(r.title))).toBe(false);
  });

  it('does NOT recommend publishing testimonials when state === unverified', () => {
    const recs = calculateCompositeScore(dataWithTestimonials('unverified')).topRecommendations;
    expect(recs.some((r) => /témoignages/i.test(r.title))).toBe(false);
  });
});
