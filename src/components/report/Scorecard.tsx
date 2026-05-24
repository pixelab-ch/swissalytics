'use client';

import { scoreColor } from '@/components/design-system/primitives';
import { scoreQualifier } from './scorecardQualifier';
import InfoBox from '@/components/InfoBox';

interface ScorecardProps {
  num: string;
  label: string;
  /** null = data not yet available (async fetch in flight) → render calm loading state */
  score: number | null;
  isLast: boolean;
  isFr: boolean;
  /** Optional short definition shown via InfoBox "i" popover next to qualifier label */
  hint?: string;
}

/**
 * One of the 4 dimension cards in the right cell of the MetricStrip.
 *
 * Loading state (score === null) renders a calm mono "calcul…"/"computing…"
 * in --sa-ink-4, no aggressive flash animation.
 *
 * Below the score bar: qualifier label (Solide/Correct/À renforcer) colored
 * via scoreColor, plus an optional InfoBox "i" popover for jargon hints.
 */
export function Scorecard({ num, label, score, isLast, isFr, hint }: ScorecardProps) {
  const isLoading = score === null;
  const color = isLoading ? 'var(--sa-ink-4)' : scoreColor(score);
  const qualifier = scoreQualifier(score, isFr);
  const qualifierColor = isLoading ? 'var(--sa-ink-4)' : scoreColor(score!);

  return (
    <div
      style={{
        padding: '28px 24px',
        borderRight: isLast ? 'none' : '1px solid var(--sa-rule)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          className="display tnum"
          style={{
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color,
            lineHeight: 1,
            ...(isLoading ? { opacity: 0.45 } : {}),
          }}
        >
          {isLoading ? 'calcul…' : score}
        </span>
        {!isLoading && (
          <span
            className="mono"
            style={{ fontSize: 11, color: 'var(--sa-ink-4)', fontWeight: 700 }}
          >
            /100
          </span>
        )}
      </div>
      <div
        style={{
          position: 'relative',
          height: 3,
          background: 'rgba(10, 10, 10, 0.1)',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div
            style={{
              position: 'absolute',
              top: -1,
              left: 0,
              height: 5,
              width: '30%',
              background: 'var(--sa-ink-4)',
              opacity: 0.3,
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              top: -1,
              left: 0,
              height: 5,
              width: `${Math.max(0, Math.min(100, score))}%`,
              background: color,
            }}
          />
        )}
      </div>
      {/* Qualifier row: label + optional InfoBox */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          className="mono"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isLoading ? 'var(--sa-ink-4)' : qualifierColor,
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          {qualifier.label}
        </span>
        {hint && !isLoading && (
          <InfoBox items={[{ term: label, definition: hint }]} />
        )}
      </div>
    </div>
  );
}
