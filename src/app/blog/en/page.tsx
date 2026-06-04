import type { Metadata } from 'next';
import { blog } from '@/lib/blog/loader';
import { buildBlogSchema, SITE_URL } from '@/lib/blog/schema';
import { BlogListing } from '@/components/blog/BlogListing';

export const metadata: Metadata = {
  title: 'Blog — Swissalytics',
  description: 'SEO & AI-search (GEO) analyses by Pixelab.',
  alternates: {
    canonical: `${SITE_URL}/blog/en`,
    languages: { fr: `${SITE_URL}/blog`, en: `${SITE_URL}/blog/en` },
  },
};

export default function BlogIndexEn() {
  const posts = blog.listArticles('en');
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBlogSchema(posts, `${SITE_URL}/blog/en`)) }}
      />
      <BlogListing posts={posts} base="/blog/en" title="The blog" />
    </>
  );
}
