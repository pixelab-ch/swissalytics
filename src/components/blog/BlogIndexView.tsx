import { blog } from '@/lib/blog/loader';
import { buildBlogSchema, serializeJsonLd, SITE_URL } from '@/lib/blog/schema';
import { BlogListing } from '@/components/blog/BlogListing';
import { blogBase, type Locale } from '@/lib/blog/types';
import { BLOG_COPY } from '@/lib/blog/copy';

/** Shared blog index for all four locales. */
export async function BlogIndexView({ locale }: { locale: Locale }) {
  const base = blogBase(locale);
  const posts = await blog.listArticles(locale);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildBlogSchema(posts, `${SITE_URL}${base}`)) }}
      />
      <BlogListing posts={posts} base={base} title={BLOG_COPY[locale].listTitle} />
    </>
  );
}
