import type { ArticleMeta } from './types';

// Re-exported so existing blog imports (`from './schema'`) keep working; the
// implementation is generic and shared with non-blog JSON-LD (StructuredData).
export { serializeJsonLd } from '../jsonld';

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
    image: a.coverImage ? `${SITE_URL}${a.coverImage}` : undefined,
    author: { '@type': 'Person', name: a.author.name, url: a.author.url },
    publisher: PUBLISHER,
    mainEntityOfPage: url,
  };
}

export function buildBreadcrumbSchema(a: ArticleMeta, url: string) {
  const isEn = a.locale === 'en';
  const blogUrl = isEn ? `${SITE_URL}/blog/en` : `${SITE_URL}/blog`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: isEn ? 'Home' : 'Accueil', item: SITE_URL },
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
