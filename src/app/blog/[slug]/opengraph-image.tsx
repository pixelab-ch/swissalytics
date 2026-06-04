import { ImageResponse } from 'next/og';
import { OG_SIZE, OG_CONTENT_TYPE, OgCard, loadOgFonts } from '@/lib/og';
import { blog } from '@/lib/blog/loader';
import { TYPE_LABEL } from '@/components/blog/ArticleCard';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = blog.getArticleBySlug(slug, 'fr');
  const kicker = a ? TYPE_LABEL['fr'][a.type] : 'Blog';
  const title = a ? a.title : 'Swissalytics';
  return new ImageResponse(
    <OgCard kicker={kicker} title={title} />,
    { ...OG_SIZE, fonts: await loadOgFonts() },
  );
}
