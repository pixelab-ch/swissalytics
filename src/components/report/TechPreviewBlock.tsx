'use client';

import type { AnalysisResult } from '@/lib/types';
import { SectionHead } from './SectionHead';

/* ===================================================================== */
/* §04 — Aperçu technique : 4 compact stat cells + link to Details tab.   */
/* ===================================================================== */

function TechPreviewCell({
  label,
  value,
  sub,
  flag,
  isLast,
}: {
  label: string;
  value: string | number;
  sub: string;
  flag?: boolean;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        padding: '16px 16px',
        borderRight: isLast ? 'none' : '1px solid var(--sa-rule)',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--sa-ink-4)',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        className="display tnum"
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          margin: '6px 0 2px',
          color: 'var(--sa-ink)',
        }}
      >
        {value}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: flag ? 'var(--sa-red)' : 'var(--sa-ink-3)',
        }}
      >
        {sub}
      </div>
    </div>
  );
}

export function TechPreviewBlock({
  report,
  headingsTotal,
  isFr,
  onGoToDetails,
}: {
  report: AnalysisResult;
  headingsTotal: number;
  isFr: boolean;
  onGoToDetails: () => void;
}) {
  const withoutAlt = report.images.withoutAlt;
  return (
    <div>
      <SectionHead
        num="04"
        title={isFr ? 'Aperçu technique' : 'Technical overview'}
        more={{
          label: isFr ? 'Tous les détails →' : 'All details →',
          onClick: onGoToDetails,
        }}
      />
      <div
        className="frame tpb-grid"
        style={{
          background: 'var(--sa-cream)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
        }}
      >
        <TechPreviewCell
          label={isFr ? 'Titres & hiérarchie' : 'Headings'}
          value={headingsTotal}
          sub={`H1 ${report.headings.h1.length} · H2 ${report.headings.h2.length} · H3 ${report.headings.h3.length}`}
          isLast={false}
        />
        <TechPreviewCell
          label="Images"
          value={report.images.total}
          sub={
            withoutAlt > 0
              ? isFr
                ? `${withoutAlt} sans alt`
                : `${withoutAlt} without alt`
              : isFr
              ? 'toutes avec alt'
              : 'all with alt'
          }
          flag={withoutAlt > 0}
          isLast={false}
        />
        <TechPreviewCell
          label={isFr ? 'Liens' : 'Links'}
          value={report.links.total}
          sub={
            isFr
              ? `${report.links.internal.length} internes · ${report.links.external.length} ext`
              : `${report.links.internal.length} internal · ${report.links.external.length} ext`
          }
          isLast={false}
        />
        <TechPreviewCell
          label={isFr ? 'Lisibilité' : 'Readability'}
          value={Math.round(report.readability.fleschScore)}
          sub="Flesch"
          isLast={true}
        />
      </div>

      {/* 4-col stat strip collapses to a 2x2 grid on mobile. The inline
          per-cell borderRight is overridden so the 2-col layout gets clean
          column + row dividers instead of stray borders. */}
      <style>{`
        @media (max-width: 640px) {
          .tpb-grid { grid-template-columns: 1fr 1fr !important; }
          .tpb-grid > * { border-right: 1px solid var(--sa-rule) !important; }
          .tpb-grid > *:nth-child(2n) { border-right: none !important; }
          .tpb-grid > *:nth-child(n + 3) { border-top: 1px solid var(--sa-rule) !important; }
        }
      `}</style>
    </div>
  );
}
