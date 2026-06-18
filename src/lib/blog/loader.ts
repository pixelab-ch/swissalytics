import 'server-only';
import { cache } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import {
  ARTICLE_TYPES,
  LOCALES,
  SLUG_KEBAB,
  isReservedSlug,
  type Article,
  type ArticleMeta,
  type ArticleType,
  type Author,
  type Locale,
} from './types';
import { fetchArticles, fetchArticleBySlug, fetchArticleLocales } from './hub';

function assertValidSlug(slug: string): void {
  if (isReservedSlug(slug)) throw new Error(`Blog: slug "${slug}" is reserved`);
  if (!SLUG_KEBAB.test(slug)) throw new Error(`Blog: slug "${slug}" must be kebab-case`);
}

/** Sort by publish date DESC, tie-broken by slug so equal-date builds are deterministic. */
function byPublishedDesc(x: ArticleMeta, y: ArticleMeta): number {
  return Date.parse(y.publishedAt) - Date.parse(x.publishedAt) || x.slug.localeCompare(y.slug);
}

function isIso(d: unknown): d is string {
  return typeof d === 'string' && !Number.isNaN(Date.parse(d)) && /^\d{4}-\d{2}-\d{2}/.test(d);
}

export function createBlogLoader(contentDir: string) {
  const authorsPath = path.join(contentDir, '_authors.json');
  let authorsCache: Record<string, Omit<Author, 'key'>> | null = null;

  function loadAuthors(): Record<string, Omit<Author, 'key'>> {
    if (authorsCache) return authorsCache;
    const parsed = JSON.parse(fs.readFileSync(authorsPath, 'utf8')) as Record<string, Omit<Author, 'key'>>;
    authorsCache = parsed;
    return parsed;
  }

  function parseFile(file: string): Article {
    const raw = fs.readFileSync(path.join(contentDir, file), 'utf8');
    const { data, content } = matter(raw);
    // Filenames are "<slug>.<locale>.mdx"; parse by the trailing locale suffix so
    // slugs containing dots can't corrupt the slug/locale split.
    const base = file.replace(/\.mdx$/, '');
    const locale = LOCALES.find((l) => base.endsWith(`.${l}`));
    if (!locale) {
      throw new Error(`Blog ${file}: filename must end with .<locale>.mdx (${LOCALES.join('|')})`);
    }
    const slug = base.slice(0, -(locale.length + 1));

    assertValidSlug(slug);
    for (const f of ['title', 'description', 'publishedAt', 'type', 'author'] as const) {
      if (!data[f]) throw new Error(`Blog ${file}: missing required frontmatter "${f}"`);
    }
    if (!ARTICLE_TYPES.includes(data.type as ArticleType)) {
      throw new Error(`Blog ${file}: invalid type "${data.type}" (one of ${ARTICLE_TYPES.join(', ')})`);
    }
    if (!isIso(data.publishedAt)) throw new Error(`Blog ${file}: publishedAt must be ISO 8601`);
    if (data.updatedAt && !isIso(data.updatedAt)) throw new Error(`Blog ${file}: updatedAt must be ISO 8601`);

    const authors = loadAuthors();
    const a = authors[data.author as string];
    if (!a) throw new Error(`Blog ${file}: unknown author "${data.author}"`);

    return {
      slug,
      locale,
      title: data.title,
      description: data.description,
      publishedAt: data.publishedAt,
      updatedAt: data.updatedAt,
      type: data.type,
      author: { key: data.author, ...a },
      tags: data.tags ?? [],
      entities: data.entities ?? [],
      featured: Boolean(data.featured),
      draft: Boolean(data.draft),
      readingMinutes: Math.max(1, Math.round(readingTime(content).minutes)),
      coverImage: data.coverImage,
      coverAlt: data.coverAlt,
      coverCaption: data.coverCaption,
      body: content,
    };
  }

  function allFiles(locale: Locale): string[] {
    if (!fs.existsSync(contentDir)) return [];
    return fs.readdirSync(contentDir).filter((f) => f.endsWith(`.${locale}.mdx`));
  }

  function listArticles(locale: Locale): ArticleMeta[] {
    const isProd = process.env.NODE_ENV === 'production';
    return allFiles(locale)
      .map((f) => parseFile(f))
      .filter((a) => (isProd ? !a.draft : true))
      .sort(byPublishedDesc)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ body: _body, ...meta }) => meta);
  }

  function getArticleBySlug(slug: string, locale: Locale): Article | null {
    const file = `${slug}.${locale}.mdx`;
    if (!fs.existsSync(path.join(contentDir, file))) return null;
    const a = parseFile(file);
    if (process.env.NODE_ENV === 'production' && a.draft) return null;
    return a;
  }

  function listArticleParams(locale: Locale): { slug: string }[] {
    return listArticles(locale).map((a) => ({ slug: a.slug }));
  }

  function getAlternateLocales(slug: string): Record<Locale, boolean> {
    return Object.fromEntries(
      LOCALES.map((l) => [l, fs.existsSync(path.join(contentDir, `${slug}.${l}.mdx`))]),
    ) as Record<Locale, boolean>;
  }

  function getRelatedArticles(slug: string, locale: Locale, limit = 3): ArticleMeta[] {
    const all = listArticles(locale).filter((a) => a.slug !== slug);
    const self = getArticleBySlug(slug, locale);
    const sameType = all.filter((a) => self && a.type === self.type);
    const sameTypeSlugs = new Set(sameType.map((a) => a.slug));
    const rest = all.filter((a) => !sameTypeSlugs.has(a.slug));
    return [...sameType, ...rest].slice(0, limit);
  }

  return {
    listArticles,
    getArticleBySlug,
    listArticleParams,
    getAlternateLocales,
    getRelatedArticles,
    assertValidSlug,
  };
}

/** Merge two article lists, deduped by slug with `primary` (the hub) winning over
 *  `fallback` (fs), then sorted by publish date DESC. Pure — unit tested in isolation. */
export function mergeArticleLists(primary: ArticleMeta[], fallback: ArticleMeta[]): ArticleMeta[] {
  const bySlug = new Map<string, ArticleMeta>();
  for (const a of fallback) bySlug.set(a.slug, a);
  for (const a of primary) bySlug.set(a.slug, a);
  return [...bySlug.values()].sort(byPublishedDesc);
}

const _blog = createBlogLoader(path.join(process.cwd(), 'content/blog'));

// Hub-first facade: the CMS hub is authoritative, the fs MDX files are the fallback (and
// keep the blog working when PAYLOAD_URL is unset or the hub is unreachable). Async, because
// the hub source is a network fetch. The hot read paths are wrapped in React's
// request-scoped cache() so a single render fetches/parses a given list/article once.
async function listArticles(locale: Locale): Promise<ArticleMeta[]> {
  const hubList = await fetchArticles(locale);
  return mergeArticleLists(hubList, _blog.listArticles(locale));
}

async function getArticleBySlug(slug: string, locale: Locale, draft = false): Promise<Article | null> {
  const fromHub = await fetchArticleBySlug(slug, locale, draft);
  return fromHub ?? _blog.getArticleBySlug(slug, locale);
}

const cachedList = cache(listArticles);
const cachedBySlug = cache(getArticleBySlug);

async function listArticleParams(locale: Locale): Promise<{ slug: string }[]> {
  return (await cachedList(locale)).map((a) => ({ slug: a.slug }));
}

async function getRelatedArticles(slug: string, locale: Locale, limit = 3): Promise<ArticleMeta[]> {
  const all = (await cachedList(locale)).filter((a) => a.slug !== slug);
  const self = await cachedBySlug(slug, locale);
  const sameType = all.filter((a) => self && a.type === self.type);
  const sameTypeSlugs = new Set(sameType.map((a) => a.slug));
  const rest = all.filter((a) => !sameTypeSlugs.has(a.slug));
  return [...sameType, ...rest].slice(0, limit);
}

async function getAlternateLocales(slug: string): Promise<Record<Locale, boolean>> {
  const fromFs = _blog.getAlternateLocales(slug);
  const fromHub = new Set(await fetchArticleLocales(slug));
  return Object.fromEntries(LOCALES.map((l) => [l, fromFs[l] || fromHub.has(l)])) as Record<Locale, boolean>;
}

export const blog = {
  listArticles: cachedList,
  getArticleBySlug: cachedBySlug,
  listArticleParams,
  getRelatedArticles,
  getAlternateLocales,
  assertValidSlug: _blog.assertValidSlug,
};
