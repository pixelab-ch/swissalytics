export type Locale = 'fr' | 'en';

export const ARTICLE_TYPES = ['authority', 'pillar', 'versus', 'decision', 'checklist'] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

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

/** Full article = meta + raw MDX body (frontmatter stripped). */
export type Article = ArticleMeta & { body: string };

/** Display label for each article `type`, per locale. Pure data (no React) so it can be
 *  shared by the card, related list, RSS feed, and OG image routes alike. */
export const TYPE_LABEL: Record<Locale, Record<ArticleType, string>> = {
  fr: { authority: 'Analyse', pillar: 'Dossier', versus: 'Comparatif', decision: 'Décision', checklist: 'Checklist' },
  en: { authority: 'Analysis', pillar: 'Guide', versus: 'Versus', decision: 'Decision', checklist: 'Checklist' },
};
