import type { Metadata } from 'next';
import { blog } from './loader';
import { SITE_URL } from './schema';
import { blogBase, LOCALES, type Locale } from './types';
import { BLOG_COPY } from './copy';

/** hreflang map for the blog index: every locale points at its own listing. */
function listLanguages(): Record<string, string> {
  return Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${blogBase(l)}`]));
}

export function buildListMetadata(locale: Locale): Metadata {
  return {
    title: BLOG_COPY[locale].metaTitle,
    description: BLOG_COPY[locale].metaDescription,
    alternates: { canonical: `${SITE_URL}${blogBase(locale)}`, languages: listLanguages() },
  };
}

export async function buildArticleMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const a = await blog.getArticleBySlug(slug, locale);
  if (!a) return {};
  const base = blogBase(locale);
  const url = `${SITE_URL}${base}/${slug}`;
  // hreflang only for the locales this article actually exists in (hub + fs).
  const alt = await blog.getAlternateLocales(slug);
  const languages: Record<string, string> = {};
  for (const l of LOCALES) if (alt[l]) languages[l] = `${SITE_URL}${blogBase(l)}/${slug}`;
  return {
    title: `${a.title} — Swissalytics`,
    description: a.description,
    alternates: { canonical: url, languages },
    openGraph: {
      title: a.title,
      description: a.description,
      type: 'article',
      url,
      locale: BLOG_COPY[locale].ogLang,
    },
  };
}
