import type { ArticleMeta } from './types';
import { blogBase } from './types';
import { BLOG_COPY } from './copy';

// Re-exported so existing blog imports (`from './schema'`) keep working; the
// implementation is generic and shared with non-blog JSON-LD (StructuredData).
export { serializeJsonLd } from '../jsonld';

/** Resolve a cover image to an absolute URL. Hub covers are already absolute
 *  (cms.pixelab.ch/...); fs/MDX covers are root-relative to the marketing site. */
function absoluteImage(src?: string): string | undefined {
  if (!src) return undefined;
  return /^https?:\/\//.test(src) ? src : `${SITE_URL}${src}`;
}

export const SITE_URL = 'https://swissalytics.com';
export const SITE_NAME = 'Swissalytics';
export const PUBLISHER = {
  '@type': 'Organization' as const,
  name: 'Pixelab',
  url: 'https://pixelab.ch',
  address: { '@type': 'PostalAddress', addressLocality: 'Genève', addressCountry: 'CH' },
};

export function buildArticleSchema(a: ArticleMeta, bodyText: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    inLanguage: a.locale,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt ?? a.publishedAt,
    wordCount: bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0,
    image: absoluteImage(a.coverImage),
    author: { '@type': 'Person', name: a.author.name, url: a.author.url },
    publisher: PUBLISHER,
    mainEntityOfPage: url,
  };
}

export function buildBreadcrumbSchema(a: ArticleMeta, url: string) {
  const blogUrl = `${SITE_URL}${blogBase(a.locale)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: BLOG_COPY[a.locale].homeLabel, item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: blogUrl },
      { '@type': 'ListItem', position: 3, name: a.title, item: url },
    ],
  };
}

export function buildOrganizationSchema() {
  return { '@context': 'https://schema.org', ...PUBLISHER };
}

export function buildBlogSchema(posts: ArticleMeta[], url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${SITE_NAME} — Blog`,
    url,
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      datePublished: p.publishedAt,
      url: `${url}/${p.slug}`,
    })),
  };
}

export function buildFaqPageSchema(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
}

export function buildHowToSchema(name: string, steps: { name: string; text: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
  };
}
