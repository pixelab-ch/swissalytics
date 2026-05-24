'use client';

import type { AnalysisResult } from '@/lib/types';
import type { PlanItem } from '@/lib/engine/plan';
import { PlanBucket } from './PlanBucket';

interface OverviewContentProps {
  report: AnalysisResult;
  headingsTotal: number;
  /** Plan buckets from buildPlan, computed once in ReportView and shared
   *  with the Plan tab for visual consistency. */
  critItems: PlanItem[];
  warnItems: PlanItem[];
  infoItems: PlanItem[];
  isFr: boolean;
  /** Switches the main rail to the Plan tab (changeTab('plan')). */
  onGoToPlan: () => void;
}

/* ---------------- private helpers (only used here) ---------------- */

function OverviewStatCard({
  num,
  label,
  value,
  sub,
}: {
  num: string;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      className="frame"
      style={{
        padding: '24px 24px 22px',
        background: 'var(--sa-cream)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--sa-ink-4)',
          fontWeight: 700,
        }}
      >
        §{num} · {label}
      </div>
      <div
        className="display tnum"
        style={{
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'var(--sa-ink)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--sa-ink-3)',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/* ---------------- exported tab content ---------------- */

/**
 * Dashboard / overview. Leads with the issues grouped into Critique /
 * Important / Bonus (same PlanBucket rendering as the Plan tab), then a
 * link to the full action plan, then the raw stat cards demoted under a
 * discreet "for info — raw figures" label.
 */
export function OverviewContent({
  report,
  headingsTotal,
  critItems,
  warnItems,
  infoItems,
  isFr,
  onGoToPlan,
}: OverviewContentProps) {
  const hasIssues =
    critItems.length > 0 || warnItems.length > 0 || infoItems.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Grouped plan buckets — leading content. */}
      {hasIssues ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <PlanBucket
            captionNum="01"
            label={isFr ? 'Critique · à faire d’abord' : 'Critical · do this first'}
            items={critItems}
            dotColor="var(--sa-red)"
          />
          <PlanBucket
            captionNum="02"
            label={isFr ? 'Important' : 'Important'}
            items={warnItems}
            dotColor="var(--sa-warn)"
          />
          <PlanBucket
            captionNum="03"
            label={isFr ? 'Bonus' : 'Bonus'}
            items={infoItems}
            dotColor="var(--sa-ink-4)"
          />
        </div>
      ) : (
        <div
          className="frame"
          style={{ background: 'var(--sa-cream)', padding: '24px' }}
        >
          <div style={{ color: 'var(--sa-ink-3)', fontSize: 14 }}>
            {isFr ? 'Aucun problème détecté.' : 'No issues detected.'}
          </div>
        </div>
      )}

      {/* 2. Link to the full action plan. */}
      <button
        type="button"
        onClick={onGoToPlan}
        className="mono"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
          appearance: 'none',
          padding: 12,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          background: 'var(--sa-ink)',
          color: 'var(--sa-cream)',
          border: '2px solid var(--sa-ink)',
          cursor: 'pointer',
        }}
      >
        {isFr ? 'Voir le plan d’action complet →' : 'See the full action plan →'}
      </button>

      {/* 3. Raw stat cards — demoted, "for info" only. */}
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--sa-ink-4)',
          fontWeight: 700,
          marginTop: 8,
        }}
      >
        ▸ {isFr ? 'Pour info — chiffres bruts' : 'For info — raw figures'}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <OverviewStatCard
          num="03"
          label={isFr ? 'Titres & hiérarchie' : 'Headings'}
          value={headingsTotal}
          sub={`H1 ${report.headings.h1.length} · H2 ${report.headings.h2.length} · H3 ${report.headings.h3.length}`}
        />
        <OverviewStatCard
          num="04"
          label={isFr ? 'Images' : 'Images'}
          value={report.images.total}
          sub={
            isFr
              ? `${report.images.withAlt} avec alt · ${report.images.withoutAlt} sans alt`
              : `${report.images.withAlt} with alt · ${report.images.withoutAlt} without alt`
          }
        />
        <OverviewStatCard
          num="05"
          label={isFr ? 'Liens' : 'Links'}
          value={report.links.total}
          sub={
            isFr
              ? `${report.links.internal.length} internes · ${report.links.external.length} externes`
              : `${report.links.internal.length} internal · ${report.links.external.length} external`
          }
        />
      </div>
    </div>
  );
}
