'use client';

import type { GeoAnalysisDegradedFlags } from '@/lib/analyzers/types';
import { useTheme } from '@/components/design-system/ThemeProvider';

interface GeoDegradedBannerProps {
  degraded: GeoAnalysisDegradedFlags;
}

const LABEL_FR: Record<keyof GeoAnalysisDegradedFlags, string> = {
  lighthouse: 'Lighthouse (Core Web Vitals)',
  seo:        'SEO technique',
  geo:        'Indexation IA',
  schema:     'Schema.org',
  eeat:       'E-E-A-T',
};
const LABEL_EN: Record<keyof GeoAnalysisDegradedFlags, string> = {
  lighthouse: 'Lighthouse (Core Web Vitals)',
  seo:        'Technical SEO',
  geo:        'AI indexation',
  schema:     'Schema.org',
  eeat:       'E-E-A-T',
};

/**
 * Brutalist v2 banner shown at the top of GeoTabContent when one or
 * more sub-analyzers failed (timeout, transient API error). Lists
 * the missing analyzers explicitly so users know which signals to
 * read with skepticism — the score is still computed (with safe
 * defaults for the failed parts) but is partial.
 */
export default function GeoDegradedBanner({ degraded }: GeoDegradedBannerProps) {
  const { lang } = useTheme();
  const isFr = lang === 'fr';
  const labels = isFr ? LABEL_FR : LABEL_EN;

  const failed = (Object.entries(degraded) as Array<[keyof GeoAnalysisDegradedFlags, boolean]>)
    .filter(([, v]) => v)
    .map(([k]) => labels[k]);

  if (failed.length === 0) return null;

  return (
    <div
      role="status"
      style={{
        border: '2px solid var(--sa-warn)',
        background: 'var(--sa-cream)',
        padding: '20px 24px',
        margin: '0 0 8px 0',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--sa-warn)',
          marginBottom: 10,
        }}
      >
        {isFr ? '§ Données partielles' : '§ Partial data'}
      </div>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--sa-ink)',
          margin: '0 0 12px 0',
        }}
      >
        {isFr ? (
          <>
            <strong>{failed.length}</strong> des 5 modules d&apos;analyse n&apos;{failed.length > 1 ? 'ont' : 'a'} pas pu s&apos;exécuter
            (délai dépassé ou erreur temporaire). Le score est calculé avec des valeurs par défaut pour ces parties&nbsp;:
          </>
        ) : (
          <>
            <strong>{failed.length}</strong> of the 5 analysis module{failed.length > 1 ? 's' : ''} couldn&apos;t run
            (timeout or transient error). The score uses default values for {failed.length > 1 ? 'those parts' : 'that part'}&nbsp;:
          </>
        )}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {failed.map((label) => (
          <span
            key={label}
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '4px 10px',
              border: '1px solid var(--sa-warn)',
              color: 'var(--sa-warn)',
              background: 'rgba(184, 123, 0, 0.06)',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
