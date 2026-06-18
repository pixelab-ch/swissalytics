import type { Metadata } from 'next';
import { ArticleView } from '@/components/blog/ArticleView';
import { blog } from '@/lib/blog/loader';
import { buildArticleMetadata } from '@/lib/blog/page-meta';

// Hub-first + ISR: pre-render known (fs) slugs at build, and render any hub-published
// slug on demand (then cache). Without this, an article published after the build 404s
// even though the index/feed/sitemap already list it. notFound() guards unknown slugs.
export const dynamicParams = true;

export async function generateStaticParams() {
  return blog.listArticleParams('fr');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildArticleMetadata(slug, 'fr');
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArticleView slug={slug} locale="fr" />;
}
