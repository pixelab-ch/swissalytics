'use client';

import type { AnalysisResult } from '@/lib/types';
import { NavEntry } from './NavEntry';
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
      {/* Segmented sub-section nav. A bordered grid where the 1px gap (over a
          rule-coloured background) draws the hairlines between cells — so it
          reads as a deliberate control, not loose labels wrapped in a block.
          6 cells in one row on desktop, 3 on tablet, 2 on phones. */}
      <nav
        role="tablist"
        className="dc-subnav"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 1,
          background: 'var(--sa-rule)',
          border: '1px solid var(--sa-rule)',
          marginBottom: 24,
        }}
      >
        {sectionDefs.map((s) => (
          <NavEntry
            key={s.key}
            variant="bar"
            num={s.num}
            label={s.label}
            active={section === s.key}
            onClick={() => setSection(s.key)}
          />
        ))}
      </nav>
      <style>{`
        @media (max-width: 1024px) { .dc-subnav { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (max-width: 640px)  { .dc-subnav { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
      <div>{content}</div>
    </div>
  );
}
