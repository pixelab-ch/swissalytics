'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/components/design-system/ThemeProvider';
import { COPY } from '@/lib/i18n/copy';
import { scoreColor } from '@/components/design-system/primitives';
import { buildPlan, verdictOf } from '@/lib/engine/plan';
import { pickVerdictIndex } from '@/lib/engine/verdictPicker';
import type { AnalysisResult, Issue } from '@/lib/types';
import DegradedBanner from './DegradedBanner';
import { Gauge } from './Gauge';
import { NavEntry } from './NavEntry';
import { Scorecard } from './Scorecard';
import { ShareButton } from './ShareButton';
import { OverviewContent } from './OverviewContent';
import { DetailsContent, type DetailsSectionKey } from './DetailsContent';
import { PlanContent } from './PlanContent';
import { GeoTabContent } from './GeoTabContent';

interface ReportViewProps {
  report: AnalysisResult;
  reportId?: string;
  readOnly?: boolean;
  cwvLoading?: boolean;
  /** True while the GEO/AI-engines analysis is still being fetched async. */
  geoLoading?: boolean;
  /** P18.B — surface "Suggestions IA en cours…" skeleton in HeadingsTab. */
  keywordSuggestionsLoading?: boolean;
  degraded?: boolean;
}

type TabKey = 'overview' | 'details' | 'plan' | 'geo';

function truncateUrl(url: string, max = 48): string {
  if (!url) return '';
  if (url.length <= max) return url;
  return url.slice(0, max - 1) + '…';
}

function parseTab(v: string | null): TabKey {
  if (v === 'details' || v === 'plan' || v === 'geo') return v;
  return 'overview';
}

/**
 * Inline since the share button needs to sit inside the right slot of the
 * MetricStrip caption bar. Not reused elsewhere → no file split.
 */
function StripCaptionBar({
  left,
  right,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="ink-b mono rv-captionBar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '10px 24px',
        background: 'var(--sa-ink)',
        color: 'var(--sa-cream)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{left}</span>
      {right !== undefined && (
        <span style={{ opacity: 0.75, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0 }}>
          {right}
        </span>
      )}
    </div>
  );
}

export default function ReportView({
  report,
  reportId,
  readOnly,
  cwvLoading,
  geoLoading,
  keywordSuggestionsLoading,
  degraded = false,
}: ReportViewProps) {
  const { lang } = useTheme();
  const isFr = lang === 'fr';
  const copy = COPY[lang];
  const router = useRouter();
  const searchParams = useSearchParams();

  // All issues — used for totalIssues + overview top list
  const allIssues = useMemo(() => {
    return [
      ...report.headings.issues.map((i) => ({ ...i, category: 'Headings' })),
      ...report.images.issues.map((i) => ({ ...i, category: 'Images' })),
      ...report.links.issues.map((i) => ({ ...i, category: isFr ? 'Liens' : 'Links' })),
      ...report.technical.issues.map((i) => ({ ...i, category: isFr ? 'Technique' : 'Technical' })),
      ...report.metadata.issues.map((i) => ({ ...i, category: isFr ? 'Métadonnées' : 'Metadata' })),
      ...report.readability.issues.map((i) => ({ ...i, category: isFr ? 'Lisibilité' : 'Readability' })),
      ...report.keywords.issues.map((i) => ({ ...i, category: isFr ? 'Contenu' : 'Content' })),
    ] satisfies Array<Issue & { category: string }>;
  }, [report, isFr]);

  const totalIssues = useMemo(
    () => allIssues.filter((i) => i.type === 'error' || i.type === 'warning').length,
    [allIssues],
  );

  // Plan
  const plan = useMemo(() => buildPlan(report), [report]);
  const critItems = useMemo(() => plan.filter((p) => p.bucket === 'crit'), [plan]);
  const warnItems = useMemo(() => plan.filter((p) => p.bucket === 'warn'), [plan]);
  const infoItems = useMemo(() => plan.filter((p) => p.bucket === 'info'), [plan]);

  // Tabs + URL sync
  const [tab, setTab] = useState<TabKey>(() => parseTab(searchParams?.get('tab') ?? null));

  useEffect(() => {
    const v = parseTab(searchParams?.get('tab') ?? null);
    setTab(v);
    // We intentionally only sync on searchParams change (back/forward nav).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function changeTab(next: TabKey) {
    setTab(next);
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    if (next === 'overview') {
      sp.delete('tab');
    } else {
      sp.set('tab', next);
    }
    const qs = sp.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  // Details section
  const [section, setSection] = useState<DetailsSectionKey>('headings');

  // Responsive: at <=768px the main rail collapses to a horizontal scrollable
  // bar and the tabs grid goes single-column. Driven entirely by the scoped
  // <style> media query below (.rv-mainNav / .rv-tabsGrid) — no JS measuring,
  // so there is no SSR/hydration mismatch and no desktop-layout flash on mobile.

  // Scroll affordance for the collapsed (mobile) rail: show a right-edge "›"
  // cap while more tabs remain off-screen, so users know it scrolls sideways.
  const railRef = useRef<HTMLElement | null>(null);
  const [railCanScrollRight, setRailCanScrollRight] = useState(false);
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const update = () => setRailCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Verdict — re-added after P7.2 with editorial copy (3 phrases per
  // tier, picked deterministically by report seed) + inline Pixelab
  // link. Same URL = same phrase across refreshes/shares.
  const verdict = verdictOf(report.score);
  const verdictPhrases = copy.verdictPhrases[verdict];
  const verdictPhrase = verdictPhrases[pickVerdictIndex(reportId ?? report.url, verdictPhrases.length)];

  const verdictState = isFr
    ? verdict === 'clean'
      ? 'EXCELLENT'
      : verdict === 'mixed'
      ? 'MOYEN'
      : 'À CORRIGER'
    : verdict === 'clean'
    ? 'EXCELLENT'
    : verdict === 'mixed'
    ? 'MIXED'
    : 'FAILING';

  const overallColor = scoreColor(report.score);

  // Scorecards
  const seoTechScore = report.technical.score;
  const contentScore = report.readability.score;
  // The IA-Ready scorecard reflects the GEO pillar specifically (indexation IA + Schema +
  // E-E-A-T), so we read geoAnalysis.geo.score — not globalScore (which mixes SEO in).
  // Returns null while geoAnalysis is still being fetched (async after main analyze) so the
  // Scorecard can render a loading state instead of a misleading 0.
  const aiReadyScore: number | null = report.geoAnalysis
    ? report.geoAnalysis.geo.score
    : null;
  const localScore = report.headings.score;

  const scorecardLabels = isFr
    ? ['SEO Technique', 'Contenu', 'IA-Ready', 'Visibilité locale']
    : ['Technical SEO', 'Content', 'AI-Ready', 'Local visibility'];

  // Section defs
  const sectionDefs: Array<{ key: DetailsSectionKey; num: string; label: string }> = [
    { key: 'headings', num: '01', label: isFr ? 'Structure sémantique' : 'Semantic structure' },
    { key: 'images', num: '02', label: isFr ? 'Images & médias' : 'Images & media' },
    { key: 'links', num: '03', label: isFr ? 'Liens & navigation' : 'Links & navigation' },
    { key: 'technical', num: '04', label: isFr ? 'Performance technique' : 'Technical performance' },
    { key: 'metadata', num: '05', label: isFr ? 'Métadonnées' : 'Metadata' },
    { key: 'readability', num: '06', label: isFr ? 'Lisibilité' : 'Readability' },
  ];

  const tabsMono = copy.tabsMono; // [OVERVIEW, DETAILS, ACTION PLAN, AI INDEXATION / GEO]
  const tabKeys: TabKey[] = ['overview', 'details', 'plan', 'geo'];

  // Main-tab rail entries: §NN number + i18n label.
  const tabDefs: Array<{ key: TabKey; num: string; label: string }> = tabKeys.map(
    (k, i) => ({ key: k, num: String(i + 1).padStart(2, '0'), label: tabsMono[i] }),
  );

  // Desktop rail style; the <=768px scoped @media (.rv-mainNav) flips it to a
  // horizontal scrollable bar.
  const mainNavStyle = {
    position: 'sticky',
    top: 16,
    alignSelf: 'start',
    borderRight: '1px solid var(--sa-rule)',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  } as const;

  const showShare = !!reportId && !readOnly;

  // Stat cards (overview)
  const headingsTotal =
    report.headings.h1.length +
    report.headings.h2.length +
    report.headings.h3.length +
    report.headings.h4.length +
    report.headings.h5.length +
    report.headings.h6.length;

  return (
    <div className="rv-shell" style={{ maxWidth: 1340, margin: '0 auto', padding: '32px 24px 80px' }}>
      <style>{`
        @media (max-width: 768px) {
          .rv-shell { padding: 24px 16px 56px !important; }
          .rv-stripGrid { grid-template-columns: 1fr !important; }
          .rv-gaugeCell {
            padding: 28px 20px !important;
            border-right: none !important;
            border-bottom: 2px solid var(--sa-ink) !important;
          }
          .rv-cardsGrid { grid-template-columns: repeat(2, 1fr) !important; }
          /* 2x2: only the left column keeps a right divider; top row keeps a bottom divider. */
          .rv-cardsGrid > * { border-right: 1px solid var(--sa-rule) !important; border-bottom: 1px solid var(--sa-rule) !important; }
          .rv-cardsGrid > *:nth-child(2n) { border-right: none !important; }
          .rv-cardsGrid > *:nth-child(n+3) { border-bottom: none !important; }
          .rv-verdictLine { padding: 16px 20px !important; }
          .rv-captionBar { padding: 10px 16px !important; }
          /* Tabs grid + rail collapse (replaces the old JS isNarrow). */
          .rv-tabsGrid { grid-template-columns: 1fr !important; }
          .rv-mainNav {
            position: static !important;
            align-self: auto !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            border-right: none !important;
            border-bottom: 1px solid var(--sa-rule) !important;
          }
          /* Collapsed horizontal rail: entries size to content and scroll. */
          .rv-mainNav > * { width: auto !important; flex: 0 0 auto !important; }
          /* Right-edge scroll affordance cap (only rendered while more tabs remain). */
          .rv-railHint {
            display: flex !important;
            align-items: center;
            justify-content: center;
            position: absolute;
            top: 0; right: 0; bottom: 1px;
            width: 34px;
            padding: 0;
            margin: 0;
            cursor: pointer;
            background: var(--sa-bg);
            border: 0;
            border-left: 1px solid var(--sa-rule);
            color: var(--sa-ink);
            font-size: 22px;
            font-weight: 700;
            line-height: 1;
          }
          .rv-railHint > span { animation: rv-nudge 1.2s ease-in-out infinite; }
        }
        @keyframes rv-nudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(3px); } }
        .rv-railHint { display: none; }
        @media (max-width: 420px) {
          .rv-cardsGrid { grid-template-columns: 1fr !important; }
          .rv-cardsGrid > * { border-right: none !important; border-bottom: 1px solid var(--sa-rule) !important; }
          .rv-cardsGrid > *:last-child { border-bottom: none !important; }
          .rv-gaugeCell { flex-direction: column !important; text-align: center; gap: 16px !important; }
        }
      `}</style>
      {degraded && <DegradedBanner isFr={isFr} />}
      {/* 1. MetricStrip */}
      <div className="frame sa-rise" style={{ background: 'var(--sa-cream)', position: 'relative' }}>
        <StripCaptionBar
          left={
            <span>
              §01 — {isFr ? 'Score global' : 'Overall score'}
            </span>
          }
          right={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <span>{truncateUrl(report.url)}</span>
              {showShare && reportId && (
                <ShareButton reportId={reportId} isFr={isFr} />
              )}
            </span>
          }
        />

        <div
          className="rv-stripGrid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
          }}
        >
          {/* LEFT CELL — gauge + verdict block */}
          <div
            className="rv-gaugeCell"
            style={{
              padding: '40px 48px',
              borderRight: '2px solid var(--sa-ink)',
              display: 'flex',
              alignItems: 'center',
              gap: 32,
            }}
          >
            <Gauge score={report.score} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span
                className="mono caption-red"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: overallColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ color: overallColor }}>&#9679;</span>
                {verdictState}
              </span>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--sa-ink)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                }}
              >
                {isFr
                  ? `${totalIssues} problème${totalIssues !== 1 ? 's' : ''} à traiter`
                  : `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} to address`}
              </div>
            </div>
          </div>

          {/* RIGHT CELL — 4 scorecards */}
          <div className="rv-cardsGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <Scorecard
              num="02"
              label={scorecardLabels[0]}
              score={seoTechScore}
              isLast={false}
              isFr={isFr}
              hint={isFr
                ? "Vitesse, HTTPS, crawlabilité, balises meta, sitemap — les fondations techniques qu'un moteur exige."
                : 'Speed, HTTPS, crawlability, meta tags, sitemap — the technical foundations search engines require.'}
            />
            <Scorecard
              num="03"
              label={scorecardLabels[1]}
              score={contentScore}
              isLast={false}
              isFr={isFr}
              hint={isFr
                ? 'Lisibilité Flesch, structure H1-H6, densité des mots-clés — est-ce que le contenu est clair et bien structuré ?'
                : 'Flesch readability, H1-H6 structure, keyword density — is the content clear and well-structured?'}
            />
            <Scorecard
              num="04"
              label={scorecardLabels[2]}
              score={aiReadyScore}
              isLast={false}
              isFr={isFr}
              hint={isFr
                ? "Est-ce que ChatGPT, Gemini, Claude, Mistral peuvent t'identifier et te citer."
                : 'Whether ChatGPT, Gemini, Claude, Mistral can identify and cite you.'}
            />
            <Scorecard
              num="05"
              label={scorecardLabels[3]}
              score={localScore}
              isLast={true}
              isFr={isFr}
              hint={isFr
                ? 'Signaux géographiques : adresse, NAP, Schema LocalBusiness.'
                : 'Geographic signals: address, NAP consistency, Schema LocalBusiness.'}
            />
          </div>
        </div>
      </div>

      {/* 2. Verdict line — editorial copy with inline Pixelab CTA.
          Pick 1 of 3 phrases per tier, deterministic by reportId/url. */}
      <div className="rv-verdictLine" style={{ padding: '20px 28px', borderBottom: '1px solid var(--sa-rule)' }}>
        <p
          className="serif"
          style={{
            fontFamily: 'var(--sa-font-serif)',
            fontStyle: 'italic',
            fontSize: 'clamp(17px, 1.8vw, 22px)',
            lineHeight: 1.45,
            margin: 0,
            color: 'var(--sa-ink)',
            fontWeight: 500,
          }}
        >
          &laquo;{' '}
          {(() => {
            // Render the phrase, replacing the literal "Pixelab" with a styled link.
            const parts = verdictPhrase.split('Pixelab');
            return parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && (
                  <a
                    href="https://pixelab.ch/contact"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--sa-red)',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                      fontStyle: 'italic',
                      fontWeight: 600,
                    }}
                  >
                    Pixelab
                  </a>
                )}
              </span>
            ));
          })()}{' '}
          &raquo;
        </p>
      </div>

      {/* 3. Main rail (left) + tab content. The rail reuses the
          SectionNavEntry pattern; below 768px it collapses to a
          horizontal scrollable bar. */}
      <div
        className="rv-tabsGrid"
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          gap: 24,
          marginTop: 26,
        }}
      >
        <div className="rv-railWrap" style={{ position: 'relative', minWidth: 0 }}>
          <nav ref={railRef} role="tablist" className="rv-mainNav noscrollbar" style={mainNavStyle}>
            {tabDefs.map((t) => (
              <NavEntry
                key={t.key}
                variant="rail"
                num={t.num}
                label={t.label}
                active={tab === t.key}
                onClick={() => changeTab(t.key)}
              />
            ))}
          </nav>
          {railCanScrollRight && (
            <button
              type="button"
              className="rv-railHint"
              aria-label={isFr ? 'Voir les autres onglets' : 'See more tabs'}
              onClick={() =>
                railRef.current?.scrollBy({
                  left: Math.round(railRef.current.clientWidth * 0.7),
                  behavior: 'smooth',
                })
              }
            >
              <span>›</span>
            </button>
          )}
        </div>

        {/* Tab content – min-width:0 prevents the 1fr grid track from
            expanding to fit nowrap children (e.g. the Détails section bar). */}
        <div style={{ minWidth: 0 }}>
          {tab === 'overview' && (
            <OverviewContent
              report={report}
              headingsTotal={headingsTotal}
              critItems={critItems}
              warnItems={warnItems}
              infoItems={infoItems}
              isFr={isFr}
              onGoToPlan={() => changeTab('plan')}
              onGoToGeo={() => changeTab('geo')}
              onGoToDetails={() => changeTab('details')}
              cwvLoading={cwvLoading}
              geoLoading={geoLoading}
            />
          )}

          {tab === 'details' && (
            <DetailsContent
              report={report}
              cwvLoading={cwvLoading}
              keywordSuggestionsLoading={keywordSuggestionsLoading}
              section={section}
              setSection={setSection}
              sectionDefs={sectionDefs}
            />
          )}

          {tab === 'plan' && (
            <PlanContent
              copy={copy}
              critItems={critItems}
              warnItems={warnItems}
              infoItems={infoItems}
              isFr={isFr}
            />
          )}

          {tab === 'geo' && <GeoTabContent report={report} isFr={isFr} />}
        </div>
      </div>
    </div>
  );
}
