import type { ArticleMeta } from '@/lib/blog/types';
import { ArticleCard } from './ArticleCard';
import Shell from '@/components/design-system/Shell';

export function BlogListing({ posts, base, title }: { posts: ArticleMeta[]; base: string; title: string }) {
  return (
    <Shell>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px' }}>
        <h1
          className="display"
          style={{ fontSize: 'clamp(44px,6vw,96px)', letterSpacing: '-0.012em', lineHeight: 0.94, margin: '0 0 40px' }}
        >
          {title}
        </h1>
        {posts.map((a) => (
          <ArticleCard key={a.slug} a={a} base={base} />
        ))}
      </div>
    </Shell>
  );
}
