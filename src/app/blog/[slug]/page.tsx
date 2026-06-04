import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Shell from '@/components/design-system/Shell';
import { blog } from '@/lib/blog/loader';
import { buildArticleSchema, buildBreadcrumbSchema, serializeJsonLd, SITE_URL } from '@/lib/blog/schema';
import { MdxContent } from '@/components/blog/MdxContent';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { ReadingProgressBar } from '@/components/blog/ReadingProgressBar';
import { RelatedArticles } from '@/components/blog/RelatedArticles';

export const dynamicParams = false;

export function generateStaticParams() {
  return blog.listArticleParams('fr');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = blog.getArticleBySlug(slug, 'fr');
  if (!a) return {};
  const alt = blog.getAlternateLocales(slug);
  return {
    title: `${a.title} — Swissalytics`,
    description: a.description,
    alternates: {
      canonical: `${SITE_URL}/blog/${slug}`,
      languages: { fr: `${SITE_URL}/blog/${slug}`, ...(alt.en ? { en: `${SITE_URL}/blog/en/${slug}` } : {}) },
    },
    openGraph: {
      title: a.title,
      description: a.description,
      type: 'article',
      url: `${SITE_URL}/blog/${slug}`,
      locale: 'fr_CH',
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = blog.getArticleBySlug(slug, 'fr');
  if (!a) notFound();
  const url = `${SITE_URL}/blog/${slug}`;
  // TableOfContents hides itself below 3 headings; collapse the side column to match.
  const hasToc = (a.body.match(/^#{2,3}\s/gm) || []).length >= 3;
  return (
    <Shell>
      <ReadingProgressBar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildArticleSchema(a, a.body, url)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildBreadcrumbSchema(a, url)) }}
      />
      <article
        lang="fr"
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '64px 24px',
          display: 'grid',
          gridTemplateColumns: hasToc ? '1fr 240px' : '1fr',
          gap: 48,
        }}
      >
        <div>
          <h1
            className="display"
            style={{ fontSize: 'clamp(36px,5vw,64px)', letterSpacing: '-0.02em', lineHeight: 1.0, margin: '0 0 24px' }}
          >
            {a.title}
          </h1>
          <MdxContent source={a.body} />
          <RelatedArticles posts={blog.getRelatedArticles(slug, 'fr', 3)} base="/blog" title="À lire aussi" />
        </div>
        {hasToc && (
          <aside>
            <TableOfContents />
          </aside>
        )}
      </article>
    </Shell>
  );
}
