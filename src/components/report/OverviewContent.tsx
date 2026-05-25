'use client';

import type { CSSProperties } from 'react';
import type { AnalysisResult } from '@/lib/types';
import type { PlanItem } from '@/lib/engine/plan';

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
}

/* ===================================================================== */
/* Shared section header: §NN red marker + title + optional "more" link. */
/* ===================================================================== */

function SectionHead({
  num,
  title,
  more,
}: {
  num: string;
  title: string;
  more?: { label: string; onClick: () => void };
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 12,
      }}
    >
      <span
        className="mono"
        style={{ fontSize: 12, fontWeight: 700, color: 'var(--sa-red)' }}
      >
        §{num}
      </span>
      <h2
        style={{
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          margin: 0,
          color: 'var(--sa-ink)',
        }}
      >
        {title}
      </h2>
      {more && (
        <button
          type="button"
          onClick={more.onClick}
          className="mono"
          style={{
            marginLeft: 'auto',
            appearance: 'none',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--sa-ink)',
            padding: 0,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--sa-ink)',
            cursor: 'pointer',
          }}
        >
          {more.label}
        </button>
      )}
    </div>
  );
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
                ? { label: isFr ? 'Crit' : 'Crit', cls: 'crit' as const }
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
                      fontSize: 15,
                      fontWeight: 600,
                      margin: '0 0 2px',
                      color: 'var(--sa-ink)',
                      lineHeight: 1.35,
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--sa-ink-3)',
                      margin: 0,
                      lineHeight: 1.45,
                    }}
                  >
                    {item.body}
                  </p>
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
/* §02 — Visibilité IA : X/4 engines + chips + robots-IA line + warning.  */
/* ===================================================================== */

/** Canonical 4 engines shown in the cockpit, in display order. */
const COCKPIT_ENGINES: Array<{ id: string; label: string }> = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude', label: 'Claude' },
  { id: 'mistral', label: 'Mistral' },
];

/** AI robots surfaced in the cockpit robots-IA line (synchronous bot-coverage). */
const COCKPIT_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];
/** AI bots whose blocking warrants a red warning (Googlebot/CCBot excluded). */
const WARN_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot'];

function AiVisibilityBlock({
  report,
  isFr,
  onGoToGeo,
}: {
  report: AnalysisResult;
  isFr: boolean;
  onGoToGeo: () => void;
}) {
  const geo = report.geoAnalysis;
  // bot-coverage is synchronous (parsed from robots.txt during /analyze).
  const bots = report.technical.botCoverage ?? [];
  const blockedWarnBots = bots.filter(
    (b) => b.status === 'blocked' && WARN_BOTS.includes(b.name),
  );

  return (
    <div>
      <SectionHead
        num="02"
        title={isFr ? 'Visibilité IA' : 'AI visibility'}
        more={{ label: isFr ? 'Détail IA →' : 'AI detail →', onClick: onGoToGeo }}
      />
      <div className="frame" style={{ background: 'var(--sa-cream)', padding: 18 }}>
        {/* Engine count + chips — skeleton until geoAnalysis arrives (async). */}
        {!geo ? (
          <AiEnginesSkeleton isFr={isFr} />
        ) : (
          (() => {
            const engines = geo.geo.indexation.engines;
            const cited = COCKPIT_ENGINES.filter(
              (e) => engines[e.id]?.indexed,
            ).length;
            return (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    gap: 12,
                  }}
                >
                  <span
                    className="display tnum"
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      letterSpacing: '-0.03em',
                      color: 'var(--sa-ink)',
                    }}
                  >
                    {cited}
                    <span style={{ color: 'var(--sa-ink-4)', fontSize: 18 }}>
                      {' '}
                      / 4
                    </span>
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--sa-ink-4)',
                      fontWeight: 700,
                      maxWidth: '12ch',
                      textAlign: 'right',
                      lineHeight: 1.4,
                    }}
                  >
                    {isFr ? 'moteurs IA te citent' : 'AI engines cite you'}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  {COCKPIT_ENGINES.map((e) => {
                    const indexed = !!engines[e.id]?.indexed;
                    return (
                      <span
                        key={e.id}
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '4px 8px',
                          border: `1px solid ${indexed ? 'var(--sa-ok)' : 'var(--sa-red)'}`,
                          color: indexed ? 'var(--sa-ok)' : 'var(--sa-red)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.label} {indexed ? '✓' : '✗'}
                      </span>
                    );
                  })}
                </div>
              </>
            );
          })()
        )}

        {/* Robots-IA line — synchronous, always shown immediately. */}
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--sa-ink-3)',
            borderTop: '1px solid var(--sa-rule)',
            paddingTop: 10,
            lineHeight: 1.7,
          }}
        >
          {isFr ? 'Robots IA · ' : 'AI robots · '}
          {COCKPIT_BOTS.map((name, i) => {
            const bot = bots.find((b) => b.name === name);
            // Default-allowed when unmentioned (robots.txt grants access by default).
            const blocked = bot?.status === 'blocked';
            return (
              <span key={name}>
                {i > 0 && ' · '}
                <span
                  style={{
                    color: blocked ? 'var(--sa-red)' : 'var(--sa-ok)',
                    fontWeight: 700,
                  }}
                >
                  {name} {blocked ? '✗' : '✓'}
                </span>
              </span>
            );
          })}
        </div>

        {/* Red warning when an AI bot is blocked. */}
        {blockedWarnBots.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              background: 'var(--sa-red)',
              color: 'var(--sa-cream)',
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
              marginTop: 10,
            }}
          >
            <span aria-hidden="true">⚠️</span>
            <span>
              {isFr
                ? `${blockedWarnBots.map((b) => b.name).join(', ')} bloqué${blockedWarnBots.length > 1 ? 's' : ''} — ces IA ne pourront pas te citer.`
                : `${blockedWarnBots.map((b) => b.name).join(', ')} blocked — those AIs won't be able to cite you.`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function AiEnginesSkeleton({ isFr }: { isFr: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--sa-ink-4)',
          fontWeight: 700,
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span aria-hidden="true">●</span>
        {isFr ? 'Interrogation des moteurs IA…' : 'Querying AI engines…'}
      </div>
      {/* Calm scanner bar — mirrors the Scorecard's loading approach. */}
      <div
        style={{
          position: 'relative',
          height: 5,
          background: 'rgba(10, 10, 10, 0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: 5,
            width: '40%',
            background: 'var(--sa-ink-4)',
            animation: 'sa-scorecard-scan 1.6s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}

/* ===================================================================== */
/* §03 — Points forts : positive signals derived from the report data.    */
/* ===================================================================== */

interface Strength {
  key: string;
  lead: string;
  rest: string;
}

/**
 * Pick the positive signals that are actually TRUE from the report data.
 * Synchronous strengths come from the always-present AnalysisResult fields;
 * the LCP strength is handled separately (async, needs a skeleton).
 */
function buildStrengths(report: AnalysisResult, isFr: boolean): Strength[] {
  const out: Strength[] = [];

  // HTTPS active + no mixed content.
  if (report.technical.isHttps && report.technical.mixedContentCount === 0) {
    out.push({
      key: 'https',
      lead: isFr ? 'HTTPS actif' : 'HTTPS active',
      rest: isFr ? ', aucun contenu mixte.' : ', no mixed content.',
    });
  }

  // Schema Organization / WebSite present (synchronous, from metadata).
  const types = report.metadata.structuredData.types ?? [];
  const hasOrg = types.some((t) => /organization/i.test(t));
  const hasSite = types.some((t) => /website/i.test(t));
  if (hasOrg || hasSite) {
    const both = hasOrg && hasSite;
    out.push({
      key: 'schema',
      lead: both
        ? 'Schema Organization + WebSite'
        : hasOrg
        ? 'Schema Organization'
        : 'Schema WebSite',
      rest: isFr ? ' détecté.' : ' detected.',
    });
  }

  // Alt-text ratio (only when most images have alt → genuinely a strength).
  if (report.images.total > 0 && report.images.withAlt >= report.images.total * 0.75) {
    out.push({
      key: 'alt',
      lead: `${report.images.withAlt} / ${report.images.total} ${isFr ? 'images' : 'images'}`,
      rest: isFr ? ' ont un texte alternatif.' : ' have alt text.',
    });
  }

  // Flesch readability (≥ 60 = readable for a general audience).
  if (report.readability.fleschScore >= 60) {
    out.push({
      key: 'flesch',
      lead: `${isFr ? 'Lisibilité Flesch' : 'Flesch readability'} ${Math.round(report.readability.fleschScore)}`,
      rest: isFr ? ' — correcte pour le grand public.' : ' — readable for a general audience.',
    });
  }

  return out;
}

/** Read LCP (mobile preferred) in ms; null when CWV data isn't here yet. */
function lcpMs(report: AnalysisResult): number | null {
  const cwv = report.technical.coreWebVitals;
  const lcp = cwv?.mobile?.lcp ?? cwv?.desktop?.lcp;
  return typeof lcp === 'number' ? lcp : null;
}

function StrengthRow({ strength }: { strength: Strength }) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.4 }}>
      <span style={{ color: 'var(--sa-ok)', fontWeight: 800, flex: 'none' }}>✓</span>
      <span style={{ color: 'var(--sa-ink-3)' }}>
        <b style={{ fontWeight: 600, color: 'var(--sa-ink)' }}>{strength.lead}</b>
        {strength.rest}
      </span>
    </div>
  );
}

function StrengthsBlock({
  report,
  isFr,
  cwvLoading,
}: {
  report: AnalysisResult;
  isFr: boolean;
  cwvLoading?: boolean;
}) {
  const strengths = buildStrengths(report, isFr);
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
          <StrengthRow
            strength={{
              key: 'lcp',
              lead: `LCP ${(lcp! / 1000).toFixed(1).replace('.', isFr ? ',' : '.')} s`,
              rest: isFr ? ' — chargement rapide.' : ' — fast load.',
            }}
          />
        ) : null}

        {strengths.map((s) => (
          <StrengthRow key={s.key} strength={s} />
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

function TechPreviewBlock({
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
        className="frame"
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
          label={isFr ? 'Images' : 'Images'}
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
          sub={isFr ? 'Flesch' : 'Flesch'}
          isLast={true}
        />
      </div>
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
 * Async data (geoAnalysis engines, CWV/LCP) arrives after the main analyze:
 * those blocks show a calm skeleton and fill in on re-render — never pop or
 * show empty/zero.
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
        <AiVisibilityBlock report={report} isFr={isFr} onGoToGeo={onGoToGeo} />
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
