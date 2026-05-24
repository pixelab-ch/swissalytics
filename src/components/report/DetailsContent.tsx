'use client';

import type { AnalysisResult } from '@/lib/types';
import HeadingsTab from '../tabs/HeadingsTab';
import ImagesTab from '../tabs/ImagesTab';
import LinksTab from '../tabs/LinksTab';
import TechnicalTab from '../tabs/TechnicalTab';
import MetadataTab from '../tabs/MetadataTab';
import ReadabilityTab from '../tabs/ReadabilityTab';

export type DetailsSectionKey =
  | 'headings'
  | 'images'
  | 'links'
  | 'technical'
  | 'metadata'
  | 'readability';

interface DetailsContentProps {
  report: AnalysisResult;
  cwvLoading?: boolean;
  /** P18.B — passed through to HeadingsTab to render the inline skeleton. */
  keywordSuggestionsLoading?: boolean;
  section: DetailsSectionKey;
  setSection: (s: DetailsSectionKey) => void;
  sectionDefs: Array<{ key: DetailsSectionKey; num: string; label: string }>;
}

/* ---------------- private helper (only used here) ---------------- */

/**
 * One entry of the horizontal sub-section bar. "Top-underline" style:
 * red bottom-border under the active tab (the main left-rail now owns the
 * red-left-border treatment). Mono uppercase, grey when inactive.
 */
function SectionNavEntry({
  num,
  label,
  active,
  onClick,
}: {
  num: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono"
      style={{
        appearance: 'none',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${active ? 'var(--sa-red)' : 'transparent'}`,
        marginBottom: -1,
        padding: '8px 0',
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontWeight: 700,
        color: active ? 'var(--sa-ink)' : 'var(--sa-ink-4)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="tnum">§{num}</span> {label}
    </button>
  );
}

/* ---------------- exported tab content ---------------- */

export function DetailsContent({
  report,
  cwvLoading,
  keywordSuggestionsLoading,
  section,
  setSection,
  sectionDefs,
}: DetailsContentProps) {
  const content = (() => {
    switch (section) {
      case 'headings':
        return (
          <HeadingsTab
            data={report.headings}
            keywords={report.keywords}
            url={report.url}
            spa={report.spa}
            keywordSuggestions={report.keywordSuggestions}
            keywordSuggestionsLoading={keywordSuggestionsLoading}
          />
        );
      case 'images':
        return <ImagesTab data={report.images} />;
      case 'links':
        return <LinksTab data={report.links} />;
      case 'technical':
        return <TechnicalTab data={report.technical} cwvLoading={cwvLoading} />;
      case 'metadata':
        return <MetadataTab data={report.metadata} />;
      case 'readability':
        return <ReadabilityTab data={report.readability} />;
      default:
        return null;
    }
  })();

  return (
    <div>
      {/* Horizontal underlined sub-section bar. Scrolls horizontally on
          narrow viewports rather than wrapping. */}
      <nav
        style={{
          display: 'flex',
          gap: 26,
          overflowX: 'auto',
          borderBottom: '1px solid var(--sa-rule)',
          marginBottom: 20,
        }}
      >
        {sectionDefs.map((s) => (
          <SectionNavEntry
            key={s.key}
            num={s.num}
            label={s.label}
            active={section === s.key}
            onClick={() => setSection(s.key)}
          />
        ))}
      </nav>
      <div>{content}</div>
    </div>
  );
}
