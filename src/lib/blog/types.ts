export const LOCALES = ['fr', 'en', 'de', 'it'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** URL base path for a locale's blog. fr is the default (no prefix); others are nested. */
export function blogBase(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '/blog' : `/blog/${locale}`;
}

// Slug rules, shared by the fs loader and the hub mapper so both sources enforce the
// same URL contract. Locale route prefixes (every locale except the default) are reserved.
export const SLUG_KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVED_BLOG_SLUGS = new Set<string>(LOCALES.filter((l) => l !== DEFAULT_LOCALE));

export function isReservedSlug(slug: string): boolean {
  return RESERVED_BLOG_SLUGS.has(slug);
}

/** A slug safe to turn into a route: kebab-case and not a reserved locale prefix. */
export function isValidArticleSlug(slug: string): boolean {
  return SLUG_KEBAB.test(slug) && !isReservedSlug(slug);
}

/** Parse an article date that may be a bare day (fs/MDX, "2025-09-08") or a full ISO
 *  datetime (hub, "2025-09-08T12:00:00.000Z"). Falls back to the epoch if unparseable. */
export function articleDate(value: string): Date {
  const d = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

// Canonical article taxonomy of the CMS hub (cms.pixelab.ch). Keep in sync with the hub
// `articles.type` field — an unknown type would degrade at render and in the sitemap.
export const ARTICLE_TYPES = [
  'pillar',
  'authority',
  'guide',
  'versus',
  'comparison',
  'decision',
  'case-study',
  'glossary',
  'checklist',
  'news',
] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

// Sitemap priority per article type (BLOG-HUB-WIRING.md §4). Higher = crawled/ranked
// more eagerly. Unknown/legacy types fall back to the lowest tier rather than degrade.
const ARTICLE_SITEMAP_PRIORITY: Record<ArticleType, number> = {
  pillar: 0.9,
  authority: 0.8,
  guide: 0.8,
  versus: 0.8,
  comparison: 0.8,
  decision: 0.8,
  'case-study': 0.7,
  glossary: 0.7,
  checklist: 0.7,
  news: 0.6,
};

// Accepts a raw string (not just ArticleType): the type is hub-sourced, so an
// unrecognized value degrades to the lowest tier instead of throwing.
export function articleSitemapPriority(type: ArticleType | (string & {})): number {
  return ARTICLE_SITEMAP_PRIORITY[type as ArticleType] ?? 0.6;
}

export type Author = {
  key: string;
  name: string;
  role: string;
  avatar: string;
  url: string;
};

/** Frontmatter after validation, normalized. */
export type ArticleMeta = {
  slug: string;
  locale: Locale;
  title: string;
  description: string;
  publishedAt: string; // ISO 8601
  updatedAt?: string;
  type: ArticleType;
  author: Author;
  tags: string[];
  entities: string[];
  featured: boolean;
  draft: boolean;
  readingMinutes: number;
  coverImage?: string;
  coverAlt?: string;
  coverCaption?: string;
};

/** A structured content block served by the hub. Typed loosely because it crosses an
 *  external API boundary; the BlockRenderer narrows on `blockType` and reads fields
 *  defensively. MDX (legacy) articles keep a plain-string body instead. */
export type Block = {
  blockType: string;
  id?: string;
  blockName?: string | null;
  [key: string]: unknown;
};

/** Full article = meta + body. String body = legacy MDX; Block[] = hub-structured. */
export type Article = ArticleMeta & { body: string | Block[] };

export function isBlockBody(body: Article['body']): body is Block[] {
  return Array.isArray(body);
}

/** Display label for each article `type`, per locale. Pure data (no React) so it can be
 *  shared by the card, related list, RSS feed, and OG image routes alike. The five
 *  original types keep their established labels; de/it added for the bilingual→4-lang move. */
export const TYPE_LABEL: Record<Locale, Record<ArticleType, string>> = {
  fr: {
    pillar: 'Dossier',
    authority: 'Analyse',
    guide: 'Guide',
    versus: 'Comparatif',
    comparison: 'Comparaison',
    decision: 'Décision',
    'case-study': 'Étude de cas',
    glossary: 'Glossaire',
    checklist: 'Checklist',
    news: 'Actualité',
  },
  en: {
    pillar: 'Guide',
    authority: 'Analysis',
    guide: 'Guide',
    versus: 'Versus',
    comparison: 'Comparison',
    decision: 'Decision',
    'case-study': 'Case Study',
    glossary: 'Glossary',
    checklist: 'Checklist',
    news: 'News',
  },
  de: {
    pillar: 'Dossier',
    authority: 'Analyse',
    guide: 'Leitfaden',
    versus: 'Versus',
    comparison: 'Vergleich',
    decision: 'Entscheidung',
    'case-study': 'Fallstudie',
    glossary: 'Glossar',
    checklist: 'Checkliste',
    news: 'News',
  },
  it: {
    pillar: 'Dossier',
    authority: 'Analisi',
    guide: 'Guida',
    versus: 'Versus',
    comparison: 'Comparazione',
    decision: 'Decisione',
    'case-study': 'Caso studio',
    glossary: 'Glossario',
    checklist: 'Checklist',
    news: 'News',
  },
};
