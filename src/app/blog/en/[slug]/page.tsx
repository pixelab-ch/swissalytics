import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Shell from '@/components/design-system/Shell';
import { blog } from '@/lib/blog/loader';
import { buildArticleSchema, buildBreadcrumbSchema, SITE_URL } from '@/lib/blog/schema';
import { MdxContent } from '@/components/blog/MdxContent';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { ReadingProgressBar } from '@/components/blog/ReadingProgressBar';

export function generateStaticParams() {
  return blog.listArticleParams('en');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = blog.getArticleBySlug(slug, 'en');
  if (!a) return {};
  const alt = blog.getAlternateLocales(slug);
  return {
    title: `${a.title} — Swissalytics`,
    description: a.description,
    alternates: {
      canonical: `${SITE_URL}/blog/en/${slug}`,
      languages: { en: `${SITE_URL}/blog/en/${slug}`, ...(alt.fr ? { fr: `${SITE_URL}/blog/${slug}` } : {}) },
    },
    openGraph: { title: a.title, description: a.description, type: 'article' },
  };
}

export default async function ArticlePageEn({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = blog.getArticleBySlug(slug, 'en');
  if (!a) notFound();
  const url = `${SITE_URL}/blog/en/${slug}`;
  return (
    <Shell>
      <ReadingProgressBar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildArticleSchema(a, a.body, url)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbSchema(a, url)) }}
      />
      <article
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '64px 24px',
          display: 'grid',
          gridTemplateColumns: '1fr 240px',
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
        </div>
        <aside>
          <TableOfContents />
        </aside>
      </article>
    </Shell>
  );
}
