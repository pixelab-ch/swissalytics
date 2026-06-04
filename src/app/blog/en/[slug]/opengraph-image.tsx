import { ImageResponse } from 'next/og';

import { TYPE_LABEL } from '@/components/blog/ArticleCard';
import { blog } from '@/lib/blog/loader';
import { OG_SIZE, OG_CONTENT_TYPE, OgCard, loadOgFonts } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = blog.getArticleBySlug(slug, 'en');

  const kicker = a ? TYPE_LABEL['en'][a.type] : 'Blog';
  const title = a ? a.title : 'Swissalytics';

  return new ImageResponse(<OgCard kicker={kicker} title={title} />, {
    ...OG_SIZE,
    fonts: await loadOgFonts(),
  });
}
