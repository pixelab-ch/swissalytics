import type { Metadata } from 'next';
import { blog } from '@/lib/blog/loader';
import { buildBlogSchema, SITE_URL } from '@/lib/blog/schema';
import { BlogListing } from '@/components/blog/BlogListing';

export const metadata: Metadata = {
  title: 'Blog — Swissalytics',
  description: 'Analyses SEO & visibilité IA (GEO) par Pixelab.',
  alternates: {
    canonical: `${SITE_URL}/blog`,
    languages: { fr: `${SITE_URL}/blog`, en: `${SITE_URL}/blog/en` },
  },
};

export default function BlogIndex() {
  const posts = blog.listArticles('fr');
  const schema = buildBlogSchema(posts, `${SITE_URL}/blog`);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <BlogListing posts={posts} base="/blog" title="Le blog" />
    </>
  );
}
