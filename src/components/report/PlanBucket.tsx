'use client';

import { type PlanItem, planSubtitle } from '@/lib/engine/plan';
import { effortLabel } from './cockpitData';
import { MediaPreviewButton } from './MediaPreviewButton';

interface PlanBucketProps {
  captionNum: string;
  label: string;
  items: PlanItem[];
  /** CSS color for the leading dot in the caption bar (red/warn/grey). */
  dotColor: string;
  isFr: boolean;
}

/**
 * Renders one bucket (CRIT / WARN / INFO) of the action plan. Items come
 * from `lib/engine/plan.buildPlan(report)`. Returns null when empty so
 * absent buckets don't take vertical space.
 */
export function PlanBucket({ captionNum, label, items, dotColor, isFr }: PlanBucketProps) {
  if (items.length === 0) return null;
  return (
    <div className="frame" style={{ background: 'var(--sa-cream)' }}>
      <div
        className="ink-b mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 20px',
          background: 'var(--sa-ink)',
          color: 'var(--sa-cream)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ color: dotColor }}>&#9679;</span>
        <span>
          §{captionNum} · {label} · {items.length}
        </span>
      </div>
      <div>
        {items.map((item, i) => (
          <div
            key={`${item.n}-${i}`}
            className="pb-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '56px 1fr auto',
              gap: 16,
              padding: '20px 24px',
              borderBottom:
                i < items.length - 1 ? '1px solid var(--sa-rule)' : 'none',
              alignItems: 'start',
            }}
          >
            <div
              className="display tnum pb-num"
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: 'var(--sa-ink-4)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {String(item.n).padStart(2, '0')}
            </div>
            {/* minWidth:0 lets this 1fr column shrink; without it an unbreakable
                URL inside item.body (e.g. "Lien cassé (404) : https://…") forces
                min-content width and overflows the card to the right. */}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  color: 'var(--sa-ink)',
                  fontSize: 18,
                  marginBottom: 4,
                  lineHeight: 1.35,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {item.title}
              </div>
              {planSubtitle(item) && (
                <div
                  style={{
                    color: 'var(--sa-ink-3)',
                    fontSize: 16,
                    lineHeight: 1.5,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {planSubtitle(item)}
                </div>
              )}
              <div
                style={{
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--sa-ink-4)',
                    fontWeight: 700,
                  }}
                >
                  {item.category}
                </span>
                {/* Action items about a specific media are previewable inline. */}
                {item.url && <MediaPreviewButton url={item.url} />}
              </div>
            </div>
            <div className="pb-effort" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  padding: '4px 8px',
                  border: '1px solid var(--sa-ink-4)',
                  color: 'var(--sa-ink)',
                  alignSelf: 'flex-start',
                  whiteSpace: 'nowrap',
                }}
              >
                {effortLabel(item.effort, isFr)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* On mobile the 3-col plan row collapses: number + body stay side by
          side, the effort badge drops onto its own row under the body,
          left-aligned. Padding shrinks too. */}
      <style>{`
        @media (max-width: 640px) {
          .pb-row {
            grid-template-columns: 40px 1fr !important;
            padding: 16px !important;
            gap: 12px !important;
          }
          .pb-num { font-size: 28px !important; }
          .pb-effort {
            grid-column: 2 !important;
            justify-content: flex-start !important;
            margin-top: 2px !important;
          }
        }
      `}</style>
    </div>
  );
}
