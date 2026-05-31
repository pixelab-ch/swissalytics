'use client';

import type { CSSProperties } from 'react';
import type { AnalysisResult } from '@/lib/types';
import { type PlanItem, planSubtitle } from '@/lib/engine/plan';
import { SectionHead } from './SectionHead';
import { IAVisibilityBlock } from './IAVisibilityBlock';
import { StrengthsBlock } from './StrengthsBlock';
import { TechPreviewBlock } from './TechPreviewBlock';

interface OverviewContentProps {
  report: AnalysisResult;
  headingsTotal: number;
  /** Plan buckets from buildPlan, computed once in ReportView. Used here only
   *  for the top-3 priority teaser + the total count on the "full plan" link.
   *  The Plan tab renders the full grouped list (these same items). */
  critItems: PlanItem[];
  warnItems: PlanItem[];
  infoItems: PlanItem[];
  isFr: boolean;
  /** Switches the main rail to the Plan tab (changeTab('plan')). */
  onGoToPlan: () => void;
  /** Switches the main rail to the GEO/AI tab. */
  onGoToGeo: () => void;
  /** Switches the main rail to the Details tab. */
  onGoToDetails: () => void;
  /** True while Core Web Vitals (LCP) is still being fetched async. */
  cwvLoading?: boolean;
  /** True while the GEO/AI-engines analysis is still being fetched async. */
  geoLoading?: boolean;
}

/* ===================================================================== */
/* §01 — À corriger en priorité : top-3 of the combined prioritized plan. */
/* ===================================================================== */

function PriorityBlock({
  topItems,
  totalCount,
  isFr,
  onGoToPlan,
}: {
  topItems: PlanItem[];
  totalCount: number;
  isFr: boolean;
  onGoToPlan: () => void;
}) {
  return (
    <div>
      <SectionHead
        num="01"
        title={isFr ? 'À corriger en priorité' : 'Fix first'}
      />
      <div className="frame" style={{ background: 'var(--sa-cream)' }}>
        {topItems.length === 0 ? (
          <div
            style={{
              padding: '20px 16px',
              color: 'var(--sa-ink-3)',
              fontSize: 14,
            }}
          >
            {isFr ? 'Aucun problème détecté.' : 'No issues detected.'}
          </div>
        ) : (
          topItems.map((item, i) => {
            const sev =
              item.bucket === 'crit'
                ? { label: isFr ? 'Crit.' : 'Crit', cls: 'crit' as const }
                : item.bucket === 'warn'
                ? { label: isFr ? 'Imp.' : 'Warn', cls: 'warn' as const }
                : { label: isFr ? 'Bonus' : 'Info', cls: 'info' as const };
            const sevStyle: CSSProperties =
              sev.cls === 'crit'
                ? {
                    background: 'var(--sa-red)',
                    color: 'var(--sa-cream)',
                    borderColor: 'var(--sa-red)',
                  }
                : sev.cls === 'warn'
                ? { color: 'var(--sa-warn)', borderColor: 'var(--sa-warn)' }
                : { color: 'var(--sa-ink-4)', borderColor: 'var(--sa-ink-4)' };
            return (
              <div
                key={`${item.n}-${i}`}
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  padding: '13px 16px',
                  borderBottom:
                    i < topItems.length - 1
                      ? '1px solid var(--sa-rule)'
                      : 'none',
                }}
              >
                <span
                  className="mono tnum"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    width: 22,
                    flex: 'none',
                    color: 'var(--sa-ink)',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      margin: '0 0 2px',
                      color: 'var(--sa-ink)',
                      lineHeight: 1.35,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.title}
                  </p>
                  {planSubtitle(item) && (
                    <p
                      style={{
                        fontSize: 14,
                        color: 'var(--sa-ink-3)',
                        margin: 0,
                        lineHeight: 1.45,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {planSubtitle(item)}
                    </p>
                  )}
                </div>
                <span
                  className="mono"
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    padding: '3px 6px',
                    border: '1px solid var(--sa-ink)',
                    flex: 'none',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    ...sevStyle,
                  }}
                >
                  {sev.label}
                </span>
              </div>
            );
          })
        )}
      </div>
      {/* Full-plan link/button → plan tab. */}
      <button
        type="button"
        onClick={onGoToPlan}
        className="mono"
        style={{
          display: 'block',
          width: '100%',
          marginTop: 12,
          textAlign: 'center',
          appearance: 'none',
          padding: 11,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: 'var(--sa-ink)',
          color: 'var(--sa-cream)',
          border: '2px solid var(--sa-ink)',
          cursor: 'pointer',
        }}
      >
        {isFr
          ? `Voir le plan d’action complet (${totalCount}) →`
          : `See the full action plan (${totalCount}) →`}
      </button>
    </div>
  );
}

/* ===================================================================== */
/* Exported cockpit dashboard.                                            */
/* ===================================================================== */

/**
 * Dashboard / overview = "cockpit": a synthesis where each block teases one
 * tab. §01 top-3 priorities → Plan tab; §02 AI visibility → GEO tab; §03
 * strengths; §04 technical preview → Details tab. The full grouped plan
 * lives only on the Plan tab now (no more duplication).
 *
 * Slim composition root: §01 PriorityBlock lives here (cockpit-only), while
 * §02/§03/§04 are extracted into their own files consuming cockpitData helpers.
 *
 * Async data (geoAnalysis engines, CWV/LCP) arrives after the main analyze:
 * those blocks show a calm skeleton while loading and fill in on re-render. If
 * a fetch terminally fails (geoLoading/cwvLoading flip to false with no data),
 * they degrade gracefully instead of animating forever.
 */
export function OverviewContent({
  report,
  headingsTotal,
  critItems,
  warnItems,
  infoItems,
  isFr,
  onGoToPlan,
  onGoToGeo,
  onGoToDetails,
  cwvLoading,
  geoLoading,
}: OverviewContentProps) {
  // Combined prioritized plan — crit first, then warn, then info. buildPlan
  // already numbers globally and sorts within each bucket, so concatenation
  // gives the right priority order for the top-3 teaser.
  const prioritized = [...critItems, ...warnItems, ...infoItems];
  const topItems = prioritized.slice(0, 3);
  const totalCount = prioritized.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PriorityBlock
        topItems={topItems}
        totalCount={totalCount}
        isFr={isFr}
        onGoToPlan={onGoToPlan}
      />

      {/* Two-column row: AI visibility + Strengths. */}
      <div className="overview-row2">
        <IAVisibilityBlock
          report={report}
          isFr={isFr}
          onGoToGeo={onGoToGeo}
          geoLoading={geoLoading}
        />
        <StrengthsBlock report={report} isFr={isFr} cwvLoading={cwvLoading} />
      </div>

      <TechPreviewBlock
        report={report}
        headingsTotal={headingsTotal}
        isFr={isFr}
        onGoToDetails={onGoToDetails}
      />

      {/* Two-column row collapses to one column under 760px. */}
      <style>{`
        .overview-row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
        }
        @media (max-width: 760px) {
          .overview-row2 { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
