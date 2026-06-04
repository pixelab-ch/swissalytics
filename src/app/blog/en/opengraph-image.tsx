import { ImageResponse } from 'next/og';
import { OG_SIZE, OG_CONTENT_TYPE, OgCard, loadOgFonts } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return new ImageResponse(
    <OgCard kicker="BLOG" title="The blog — Swissalytics" />,
    { ...OG_SIZE, fonts: await loadOgFonts() }
  );
}
