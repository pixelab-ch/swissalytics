import { describe, it, expect } from 'vitest';
import { normalizeEeatSignals } from '../normalizeEeatSignals';
import type { GeoAnalysisResult } from '../types';

/**
 * normalizeEeatSignals — backward-compat shim tests.
 *
 * Verifies that legacy persisted reports (pre-3-state branch, ≤2026-05-11) are
 * correctly up-coerced so that consumers of `rowToStored` always receive the
 * current `{ found, state }` shape.
 */

/** Build a minimal GeoAnalysisResult whose eeat.signals can be overridden. */
function makeGeo(signals: unknown): GeoAnalysisResult {
  return {
    url: 'https://example.com',
    timestamp: '2026-05-11T00:00:00Z',
    globalScore: 50,
    category: 'Moyen',
    seo: { score: 50, breakdown: { lighthouse: 50, technicalSEO: 50, content: 50 }, lighthouse: { performance: 50, accessibility: 50, bestPractices: 50, seo: 50 } },
    geo: {
      score: 50,
      breakdown: { indexation: 50, schema: 50, eeat: 50 },
      indexation: { score: 50, totalIndexed: 0, totalEnabled: 0, engines: {} },
      schema: { score: 50, totalFound: 0, schemas: { organization: false, author: false, faqPage: false, breadcrumb: false, article: false, website: false } },
      eeat: {
        score: 60,
        signals: signals as GeoAnalysisResult['geo']['eeat']['signals'],
      },
    },
    recommendations: [],
    projection: {
      threeMonths: { estimatedScore: 55, gain: 5, quickWins: [], requiredActions: [] },
      sixMonths: { estimatedScore: 60, gain: 10, quickWins: [], requiredActions: [] },
    },
  };
}

describe('normalizeEeatSignals — legacy boolean legalMentions', () => {
  it('coerces legalMentions: true → { found: true, state: "present" }', () => {
    const legacy = {
      legalMentions: true,
      teamPage: { found: true },
      contactPage: { found: false },
      testimonials: { found: false, count: 0 },
    };
    const result = normalizeEeatSignals(makeGeo(legacy));
    const sig = result.geo.eeat.signals;
    expect(sig.legalMentions).toEqual({ found: true, state: 'present' });
  });

  it('coerces legalMentions: false → { found: false, state: "absent" }', () => {
    const legacy = {
      legalMentions: false,
      teamPage: { found: false },
      contactPage: { found: false },
      testimonials: { found: false, count: 0 },
    };
    const result = normalizeEeatSignals(makeGeo(legacy));
    expect(result.geo.eeat.signals.legalMentions).toEqual({ found: false, state: 'absent' });
  });
});

describe('normalizeEeatSignals — missing state on other signals', () => {
  it('adds state: "present" when found is true and state is missing', () => {
    const legacy = {
      legalMentions: true,
      teamPage: { found: true },           // no state
      contactPage: { found: false },        // no state
      testimonials: { found: false, count: 0 }, // no state
    };
    const result = normalizeEeatSignals(makeGeo(legacy));
    const sig = result.geo.eeat.signals;
    expect(sig.teamPage.state).toBe('present');
    expect(sig.contactPage.state).toBe('absent');
  });

  it('full legacy fixture normalizes correctly', () => {
    // Exactly the fixture specified in the review brief:
    const legacy = {
      legalMentions: true,
      teamPage: { found: true },
      contactPage: { found: false },
      testimonials: { found: false, count: 0 },
    };
    const result = normalizeEeatSignals(makeGeo(legacy));
    const sig = result.geo.eeat.signals;

    expect(sig.legalMentions).toEqual({ found: true, state: 'present' });
    expect(sig.teamPage.state).toBe('present');
    expect(sig.contactPage.state).toBe('absent');
    expect(sig.testimonials.state).toBe('absent');
  });
});

describe('normalizeEeatSignals — already-new shape passes through unchanged', () => {
  it('is idempotent for a fully 3-state object', () => {
    const modern = {
      legalMentions: { found: true, state: 'present' as const },
      teamPage: { found: true, state: 'present' as const, quality: 'high', authorsCount: 3 },
      contactPage: { found: false, state: 'absent' as const, hasEmail: false, hasPhone: false, hasAddress: false },
      testimonials: { found: false, state: 'unverified' as const, count: 0, hasSchema: false },
    };
    const geo = makeGeo(modern);
    const result = normalizeEeatSignals(geo);
    const sig = result.geo.eeat.signals;

    expect(sig.legalMentions).toEqual({ found: true, state: 'present' });
    expect(sig.teamPage.state).toBe('present');
    expect(sig.contactPage.state).toBe('absent');
    expect(sig.testimonials.state).toBe('unverified');
  });
});

describe('normalizeEeatSignals — null/undefined safety', () => {
  it('returns the geo unchanged when geo.eeat is absent', () => {
    const geo = makeGeo({});
    // Remove eeat entirely
    const noEeat = { ...geo, geo: { ...geo.geo, eeat: undefined as unknown as GeoAnalysisResult['geo']['eeat'] } };
    const result = normalizeEeatSignals(noEeat);
    expect(result).toEqual(noEeat);
  });

  it('handles a null geo_analysis gracefully (caller guards, but belt-and-suspenders)', () => {
    // The caller already checks for null before calling, but the function should
    // not throw on a degenerate input.
    const result = normalizeEeatSignals(null as unknown as GeoAnalysisResult);
    expect(result).toBeNull();
  });
});
