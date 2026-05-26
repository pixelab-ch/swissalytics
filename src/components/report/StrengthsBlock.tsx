'use client';

import type { AnalysisResult } from '@/lib/types';
import { SectionHead } from './SectionHead';
import { buildStrengths, lcpMs } from './cockpitData';

/* ===================================================================== */
/* §03 — Points forts : positive signals derived from the report data.    */
/* ===================================================================== */

function StrengthRow({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.4 }}>
      <span style={{ color: 'var(--sa-ok)', fontWeight: 800, flex: 'none' }}>✓</span>
      <span style={{ color: 'var(--sa-ink-3)' }}>{text}</span>
    </div>
  );
}

/**
 * Render a strength entry. The leading clause (everything before the first
 * comma or em-dash) is bolded to match the original visual emphasis.
 */
function StrengthEntry({ text }: { text: string }) {
  const m = text.match(/^(.*?)(,| —| -)(.*)$/);
  if (!m) {
    return <StrengthRow text={text} />;
  }
  const [, lead, sep, rest] = m;
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.4 }}>
      <span style={{ color: 'var(--sa-ok)', fontWeight: 800, flex: 'none' }}>✓</span>
      <span style={{ color: 'var(--sa-ink-3)' }}>
        <b style={{ fontWeight: 600, color: 'var(--sa-ink)' }}>{lead}</b>
        {sep}
        {rest}
      </span>
    </div>
  );
}

export function StrengthsBlock({
  report,
  isFr,
  cwvLoading,
}: {
  report: AnalysisResult;
  isFr: boolean;
  cwvLoading?: boolean;
}) {
  const strengths = buildStrengths(report);
  const lcp = lcpMs(report);
  const lcpFast = lcp !== null && lcp <= 2500;
  // Skeleton only while CWV is actively loading. If CWV finished but isn't
  // fast (or never arrived), we just omit the LCP row — never show a skeleton
  // that would never resolve.
  const showLcpSkeleton = lcp === null && !!cwvLoading;

  const hasAny = strengths.length > 0 || lcpFast || showLcpSkeleton;

  return (
    <div>
      <SectionHead num="03" title={isFr ? 'Points forts' : 'Strengths'} />
      <div
        className="frame"
        style={{
          background: 'var(--sa-cream)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* LCP strength — skeleton while CWV is loading, then fills in. */}
        {showLcpSkeleton ? (
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--sa-ink-4)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span aria-hidden="true">●</span>
            {isFr ? 'Mesure de la vitesse (LCP)…' : 'Measuring speed (LCP)…'}
          </div>
        ) : lcpFast ? (
          <StrengthEntry
            text={
              isFr
                ? `LCP ${(lcp! / 1000).toFixed(1).replace('.', ',')} s — chargement rapide.`
                : `LCP ${(lcp! / 1000).toFixed(1)} s — fast load.`
            }
          />
        ) : null}

        {strengths.map((s) => (
          <StrengthEntry key={s.key} text={isFr ? s.fr : s.en} />
        ))}

        {!hasAny && (
          <div style={{ fontSize: 13, color: 'var(--sa-ink-3)' }}>
            {isFr
              ? 'Aucun point fort majeur détecté pour l’instant.'
              : 'No major strength detected yet.'}
          </div>
        )}
      </div>
    </div>
  );
}
