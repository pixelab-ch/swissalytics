import type { Metadata } from 'next';
import { ArticleView } from '@/components/blog/ArticleView';
import { blog } from '@/lib/blog/loader';
import { buildArticleMetadata } from '@/lib/blog/page-meta';

// Hub-first + ISR: pre-render known (fs) slugs at build, and render any hub-published
// slug on demand (then cache). de/it have no fs articles, so every de/it article will be
// hub-published and rendered on demand. notFound() guards unknown slugs.
export const dynamicParams = true;

export async function generateStaticParams() {
  return blog.listArticleParams('it');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildArticleMetadata(slug, 'it');
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArticleView slug={slug} locale="it" />;
}
