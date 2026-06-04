import Link from 'next/link';
import type { ArticleMeta } from '@/lib/blog/types';
import { TYPE_LABEL } from './ArticleCard';

export function RelatedArticles({
  posts,
  base,
  title,
}: {
  posts: ArticleMeta[];
  base: string;
  title: string;
}) {
  if (posts.length === 0) return null;
  return (
    <section style={{ borderTop: '2px solid var(--sa-ink)', marginTop: 64, paddingTop: 20 }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--sa-ink-4)',
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {posts.map((a) => (
        <Link
          key={a.slug}
          href={`${base}/${a.slug}`}
          style={{
            display: 'block',
            borderTop: '1px solid var(--sa-rule)',
            padding: '14px 0',
            textDecoration: 'none',
            color: 'var(--sa-ink)',
            fontWeight: 600,
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--sa-red)',
              marginRight: 10,
            }}
          >
            {TYPE_LABEL[a.locale][a.type]}
          </span>
          {a.title}
        </Link>
      ))}
    </section>
  );
}
