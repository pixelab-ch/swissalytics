import { ImageResponse } from 'next/og';
import { blog } from './loader';
import { TYPE_LABEL, type Locale } from './types';
import { OG_SIZE, OgCard, loadOgFonts } from '../og';

/** Static params for the per-article OG image route, for a given locale. */
export function articleOgParams(locale: Locale): Promise<{ slug: string }[]> {
  return blog.listArticleParams(locale);
}

/** Build the OG image for one article (kicker = localized type label, title = headline). */
export async function articleOgImage(slug: string, locale: Locale): Promise<ImageResponse> {
  const a = await blog.getArticleBySlug(slug, locale);
  const kicker = a ? TYPE_LABEL[locale][a.type] : 'Blog';
  const title = a ? a.title : 'Swissalytics';
  return new ImageResponse(<OgCard kicker={kicker} title={title} />, {
    ...OG_SIZE,
    fonts: await loadOgFonts(),
  });
}
