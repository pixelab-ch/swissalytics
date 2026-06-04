import Link from 'next/link';
import type { ArticleMeta, ArticleType, Locale } from '@/lib/blog/types';

export const TYPE_LABEL: Record<Locale, Record<ArticleType, string>> = {
  fr: { authority: 'Analyse', pillar: 'Dossier', versus: 'Comparatif', decision: 'Décision', checklist: 'Checklist' },
  en: { authority: 'Analysis', pillar: 'Guide', versus: 'Versus', decision: 'Decision', checklist: 'Checklist' },
};

export function ArticleCard({ a, base }: { a: ArticleMeta; base: string }) {
  return (
    <Link
      href={`${base}/${a.slug}`}
      style={{
        display: 'block',
        borderTop: '2px solid var(--sa-ink)',
        padding: '24px 0',
        textDecoration: 'none',
        color: 'var(--sa-ink)',
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sa-red)' }}
      >
        {TYPE_LABEL[a.locale][a.type]} · {a.readingMinutes} min
      </div>
      <h2 className="display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: '8px 0' }}>
        {a.title}
      </h2>
      <p style={{ color: 'var(--sa-ink-2)', margin: 0 }}>{a.description}</p>
    </Link>
  );
}
