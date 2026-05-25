'use client';

import type { AnalysisResult } from '@/lib/types';
import type { GeoIndexationEngineResult } from '@/lib/analyzers/types';
import { SectionHead } from './SectionHead';
import { citedTestedCounts, engineState, COCKPIT_ENGINES } from './cockpitData';

/** AI robots surfaced in the cockpit robots-IA line (synchronous bot-coverage). */
const COCKPIT_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];
/** AI bots whose blocking warrants a red warning (Googlebot/CCBot excluded). */
const WARN_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot'];

/* ===================================================================== */
/* §02 — Visibilité IA : X/N engines + chips + robots-IA line + warning.  */
/* ===================================================================== */

/**
 * @param geoLoading True while fetchGeo() is still in flight. Used to choose
 *   between the animated skeleton (loading) and the TERMINAL degraded state
 *   (load finished, no geoAnalysis → AI engines unavailable) so the skeleton
 *   never animates forever on a geo-fetch failure.
 */
export function IAVisibilityBlock({
  report,
  isFr,
  onGoToGeo,
  geoLoading,
}: {
  report: AnalysisResult;
  isFr: boolean;
  onGoToGeo: () => void;
  geoLoading?: boolean;
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
        {/* Engine count + chips.
            - geo present       → chips
            - !geo + geoLoading → skeleton (still fetching)
            - !geo + !geoLoading → TERMINAL degraded state (fetch failed) */}
        {geo ? (
          <AiEngines engines={geo.geo.indexation.engines} isFr={isFr} />
        ) : geoLoading ? (
          <AiEnginesSkeleton isFr={isFr} />
        ) : (
          <AiEnginesUnavailable isFr={isFr} />
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

/** The resolved engine view: honest "X / N" headline + per-engine chips. */
function AiEngines({
  engines,
  isFr,
}: {
  engines: Record<string, GeoIndexationEngineResult>;
  isFr: boolean;
}) {
  const { cited, tested } = citedTestedCounts(engines, COCKPIT_ENGINES);
  return (
    <div style={{ marginBottom: 12 }}>
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
            / {tested}
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
            maxWidth: '14ch',
            textAlign: 'right',
            lineHeight: 1.4,
          }}
        >
          {isFr ? 'moteurs te citent' : 'engines cite you'}
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
          const state = engineState(engines, e.id);
          // Honest per-state styling: green ✓ cited, red ✗ not cited,
          // grey/warn "indisponible" on error, neutral grey "non testé".
          let border: string;
          let color: string;
          let suffix: string;
          if (state === 'indexed') {
            border = 'var(--sa-ok)';
            color = 'var(--sa-ok)';
            suffix = '✓';
          } else if (state === 'not-indexed') {
            border = 'var(--sa-red)';
            color = 'var(--sa-red)';
            suffix = '✗';
          } else if (state === 'error') {
            border = 'var(--sa-warn)';
            color = 'var(--sa-warn)';
            suffix = isFr ? 'indisponible' : 'unavailable';
          } else {
            // untested
            border = 'var(--sa-ink-4)';
            color = 'var(--sa-ink-4)';
            suffix = isFr ? 'non testé' : 'not tested';
          }
          return (
            <span
              key={e.id}
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 8px',
                border: `1px solid ${border}`,
                color,
                whiteSpace: 'nowrap',
              }}
            >
              {e.label} {suffix}
            </span>
          );
        })}
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

/**
 * TERMINAL degraded state — fetchGeo() resolved with no data (HTTP error,
 * timeout, bad JSON). Shows a calm "unavailable, retry" message instead of an
 * animated skeleton that would never resolve. The "Détail IA →" link lives in
 * the section header (always rendered).
 */
function AiEnginesUnavailable({ isFr }: { isFr: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
          fontSize: 13,
          lineHeight: 1.45,
          color: 'var(--sa-ink-3)',
        }}
      >
        <span style={{ color: 'var(--sa-warn)', fontWeight: 800, flex: 'none' }} aria-hidden="true">
          ⚠
        </span>
        <span>
          {isFr
            ? 'Moteurs IA indisponibles — réessayez l’analyse.'
            : 'AI engines unavailable — retry the analysis.'}
        </span>
      </div>
    </div>
  );
}
