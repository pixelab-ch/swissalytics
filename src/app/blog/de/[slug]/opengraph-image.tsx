import { OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og';
import { articleOgImage, articleOgParams } from '@/lib/blog/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateStaticParams() {
  return articleOgParams('de');
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return articleOgImage(slug, 'de');
}
