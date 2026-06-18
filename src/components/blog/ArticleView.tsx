import { notFound } from 'next/navigation';
import { draftMode } from 'next/headers';
import Shell from '@/components/design-system/Shell';
import { blog } from '@/lib/blog/loader';
import { buildArticleSchema, buildBreadcrumbSchema, serializeJsonLd, SITE_URL } from '@/lib/blog/schema';
import { MdxContent } from '@/components/blog/MdxContent';
import { BlockRenderer } from '@/components/blog/BlockRenderer';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { ReadingProgressBar } from '@/components/blog/ReadingProgressBar';
import { RelatedArticles } from '@/components/blog/RelatedArticles';
import { bodyToPlainText, countTocHeadings } from '@/lib/blog/blocks';
import { blogBase, isBlockBody, type Locale } from '@/lib/blog/types';
import { BLOG_COPY } from '@/lib/blog/copy';

/** Shared article page for all four blog locales. Renders a hub (Block[]) body via the
 *  BlockRenderer, or a legacy MDX (string) body via MdxContent. */
export async function ArticleView({ slug, locale }: { slug: string; locale: Locale }) {
  // Draft Mode (Live Preview): when the preview cookie is set, fetch the hub draft.
  // Statically generated otherwise (isEnabled === false at build).
  const { isEnabled: preview } = await draftMode();
  const a = await blog.getArticleBySlug(slug, locale, preview);
  if (!a) notFound();

  const base = blogBase(locale);
  const url = `${SITE_URL}${base}/${slug}`;
  // TableOfContents hides itself below 3 headings; collapse the side column to match.
  const hasToc = countTocHeadings(a.body) >= 3;
  const related = await blog.getRelatedArticles(slug, locale, 3);

  return (
    <Shell>
      <ReadingProgressBar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildArticleSchema(a, bodyToPlainText(a.body), url)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildBreadcrumbSchema(a, url)) }}
      />
      <article
        lang={locale}
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
          {isBlockBody(a.body) ? <BlockRenderer blocks={a.body} /> : <MdxContent source={a.body} />}
          <RelatedArticles posts={related} base={base} title={BLOG_COPY[locale].relatedTitle} />
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
