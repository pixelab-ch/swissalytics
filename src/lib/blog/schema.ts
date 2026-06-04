import type { ArticleMeta } from './types';

export const SITE_URL = 'https://swissalytics.com';
export const SITE_NAME = 'Swissalytics';
export const PUBLISHER = {
  '@type': 'Organization' as const,
  name: 'Pixelab',
  url: 'https://pixelab.ch',
  address: { '@type': 'PostalAddress', addressLocality: 'Genève', addressCountry: 'CH' },
};

/**
 * Serialize a JSON-LD object for safe inlining in <script type="application/ld+json">.
 * JSON.stringify does NOT escape `<`, U+2028 or U+2029 — a literal `</script>` in any
 * field (plausible on a blog about HTML/Schema.org) would break out of the script tag.
 * Uses String.fromCharCode to avoid embedding the (invisible) line separators in source.
 */
export function serializeJsonLd(obj: unknown): string {
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(obj)
    .split('<')
    .join('\\u003c')
    .split(LS)
    .join('\\u2028')
    .split(PS)
    .join('\\u2029');
}

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
