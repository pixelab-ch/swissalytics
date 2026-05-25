import { describe, it, expect } from 'vitest';
import type { AnalysisResult } from '@/lib/types';
import type { GeoIndexationEngineResult } from '@/lib/analyzers/types';
import {
  engineState,
  buildStrengths,
  lcpMs,
  citedTestedCounts,
  COCKPIT_ENGINES,
  effortLabel,
} from '../cockpitData';

/* ---------------------------------------------------------------- */
/* engineState                                                       */
/* ---------------------------------------------------------------- */

type Engines = Record<string, GeoIndexationEngineResult>;

function eng(partial: Partial<GeoIndexationEngineResult>): GeoIndexationEngineResult {
  return { indexed: false, confidence: 'low', mentions: 0, ...partial };
}

describe('engineState', () => {
  it('untested when the engine key is absent', () => {
    const engines: Engines = {};
    expect(engineState(engines, 'chatgpt')).toBe('untested');
  });

  it('error when the engine has an error message (even if indexed false)', () => {
    const engines: Engines = { chatgpt: eng({ indexed: false, error: 'HTTP 404' }) };
    expect(engineState(engines, 'chatgpt')).toBe('error');
  });

  it('error takes precedence over indexed', () => {
    const engines: Engines = { chatgpt: eng({ indexed: true, error: 'timeout' }) };
    expect(engineState(engines, 'chatgpt')).toBe('error');
  });

  it('indexed when present, no error, indexed true', () => {
    const engines: Engines = { gemini: eng({ indexed: true }) };
    expect(engineState(engines, 'gemini')).toBe('indexed');
  });

  it('not-indexed when present, no error, indexed false', () => {
    const engines: Engines = { mistral: eng({ indexed: false }) };
    expect(engineState(engines, 'mistral')).toBe('not-indexed');
  });
});

/* ---------------------------------------------------------------- */
/* citedTestedCounts                                                 */
/* ---------------------------------------------------------------- */

describe('citedTestedCounts', () => {
  it('counts only indexed as cited and excludes error + untested from tested', () => {
    // chatgpt indexed, gemini not-indexed, claude errored, mistral untested.
    const engines: Engines = {
      chatgpt: eng({ indexed: true }),
      gemini: eng({ indexed: false }),
      claude: eng({ indexed: false, error: 'HTTP 401' }),
      // mistral absent → untested
    };
    const { cited, tested } = citedTestedCounts(engines, COCKPIT_ENGINES);
    // cited: only chatgpt
    expect(cited).toBe(1);
    // tested: chatgpt + gemini (claude errored, mistral untested → excluded)
    expect(tested).toBe(2);
  });

  it('all four tested, two cited', () => {
    const engines: Engines = {
      chatgpt: eng({ indexed: true }),
      gemini: eng({ indexed: true }),
      claude: eng({ indexed: false }),
      mistral: eng({ indexed: false }),
    };
    const { cited, tested } = citedTestedCounts(engines, COCKPIT_ENGINES);
    expect(cited).toBe(2);
    expect(tested).toBe(4);
  });

  it('zero tested when all untested or errored', () => {
    const engines: Engines = {
      chatgpt: eng({ indexed: false, error: 'x' }),
    };
    const { cited, tested } = citedTestedCounts(engines, COCKPIT_ENGINES);
    expect(cited).toBe(0);
    expect(tested).toBe(0);
  });
});

/* ---------------------------------------------------------------- */
/* buildStrengths                                                    */
/* ---------------------------------------------------------------- */

function baseReport(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  // Minimal report with no strengths by default.
  const r = {
    technical: {
      isHttps: false,
      mixedContentCount: 0,
    },
    metadata: {
      structuredData: { exists: false, types: [] as string[] },
    },
    images: { total: 0, withAlt: 0 },
    readability: { fleschScore: 0 },
  } as unknown as AnalysisResult;
  return { ...r, ...overrides } as AnalysisResult;
}

function keysOf(report: AnalysisResult): string[] {
  return buildStrengths(report).map((s) => s.key);
}

describe('buildStrengths — HTTPS', () => {
  it('includes https when isHttps + no mixed content', () => {
    const r = baseReport({
      technical: { isHttps: true, mixedContentCount: 0 } as AnalysisResult['technical'],
    });
    expect(keysOf(r)).toContain('https');
  });

  it('excludes https when not https', () => {
    const r = baseReport({
      technical: { isHttps: false, mixedContentCount: 0 } as AnalysisResult['technical'],
    });
    expect(keysOf(r)).not.toContain('https');
  });

  it('excludes https when there is mixed content', () => {
    const r = baseReport({
      technical: { isHttps: true, mixedContentCount: 3 } as AnalysisResult['technical'],
    });
    expect(keysOf(r)).not.toContain('https');
  });
});

describe('buildStrengths — alt ratio', () => {
  it('excludes alt at ratio 0.74', () => {
    // 74/100 = 0.74 < 0.75
    const r = baseReport({
      images: { total: 100, withAlt: 74 } as AnalysisResult['images'],
    });
    expect(keysOf(r)).not.toContain('alt');
  });

  it('includes alt at ratio exactly 0.75', () => {
    const r = baseReport({
      images: { total: 100, withAlt: 75 } as AnalysisResult['images'],
    });
    expect(keysOf(r)).toContain('alt');
  });

  it('includes alt at ratio 1.0', () => {
    const r = baseReport({
      images: { total: 10, withAlt: 10 } as AnalysisResult['images'],
    });
    expect(keysOf(r)).toContain('alt');
  });

  it('excludes alt when there are no images', () => {
    const r = baseReport({
      images: { total: 0, withAlt: 0 } as AnalysisResult['images'],
    });
    expect(keysOf(r)).not.toContain('alt');
  });
});

describe('buildStrengths — Flesch', () => {
  it('excludes flesch at 59', () => {
    const r = baseReport({
      readability: { fleschScore: 59 } as AnalysisResult['readability'],
    });
    expect(keysOf(r)).not.toContain('flesch');
  });

  it('includes flesch at exactly 60', () => {
    const r = baseReport({
      readability: { fleschScore: 60 } as AnalysisResult['readability'],
    });
    expect(keysOf(r)).toContain('flesch');
  });
});

describe('buildStrengths — schema', () => {
  it('includes schema when Organization present', () => {
    const r = baseReport({
      metadata: {
        structuredData: { exists: true, types: ['Organization'] },
      } as AnalysisResult['metadata'],
    });
    expect(keysOf(r)).toContain('schema');
  });

  it('includes schema when WebSite present', () => {
    const r = baseReport({
      metadata: {
        structuredData: { exists: true, types: ['WebSite'] },
      } as AnalysisResult['metadata'],
    });
    expect(keysOf(r)).toContain('schema');
  });

  it('excludes schema when neither present', () => {
    const r = baseReport({
      metadata: {
        structuredData: { exists: true, types: ['Article'] },
      } as AnalysisResult['metadata'],
    });
    expect(keysOf(r)).not.toContain('schema');
  });
});

describe('buildStrengths — fr/en copy', () => {
  it('returns typed entries with fr + en strings', () => {
    const r = baseReport({
      technical: { isHttps: true, mixedContentCount: 0 } as AnalysisResult['technical'],
    });
    const https = buildStrengths(r).find((s) => s.key === 'https');
    expect(https).toBeDefined();
    expect(typeof https!.fr).toBe('string');
    expect(typeof https!.en).toBe('string');
    expect(https!.fr).not.toBe(https!.en);
  });
});

/* ---------------------------------------------------------------- */
/* lcpMs                                                             */
/* ---------------------------------------------------------------- */

describe('lcpMs', () => {
  it('returns mobile lcp when present', () => {
    const r = baseReport({
      technical: {
        coreWebVitals: { mobile: { lcp: 1800 }, desktop: { lcp: 1100 } },
      } as unknown as AnalysisResult['technical'],
    });
    expect(lcpMs(r)).toBe(1800);
  });

  it('falls back to desktop lcp when mobile absent', () => {
    const r = baseReport({
      technical: {
        coreWebVitals: { mobile: null, desktop: { lcp: 1100 } },
      } as unknown as AnalysisResult['technical'],
    });
    expect(lcpMs(r)).toBe(1100);
  });

  it('returns null when no CWV', () => {
    const r = baseReport({
      technical: {} as AnalysisResult['technical'],
    });
    expect(lcpMs(r)).toBeNull();
  });
});

/* ---------------------------------------------------------------- */
/* effortLabel                                                       */
/* ---------------------------------------------------------------- */

describe('effortLabel', () => {
  it('FR S/M/L → faible/moyen/élevé', () => {
    expect(effortLabel('S', true)).toBe('Effort faible');
    expect(effortLabel('M', true)).toBe('Effort moyen');
    expect(effortLabel('L', true)).toBe('Effort élevé');
  });

  it('EN S/M/L → low/medium/high', () => {
    expect(effortLabel('S', false)).toBe('Low effort');
    expect(effortLabel('M', false)).toBe('Medium effort');
    expect(effortLabel('L', false)).toBe('High effort');
  });
});
