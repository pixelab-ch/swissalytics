import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import {
  ARTICLE_TYPES,
  type Article,
  type ArticleMeta,
  type ArticleType,
  type Author,
  type Locale,
} from './types';

const RESERVED_SLUGS = new Set(['en']);
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertValidSlug(slug: string): void {
  if (RESERVED_SLUGS.has(slug)) throw new Error(`Blog: slug "${slug}" is reserved`);
  if (!KEBAB.test(slug)) throw new Error(`Blog: slug "${slug}" must be kebab-case`);
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
    let locale: Locale;
    if (base.endsWith('.fr')) locale = 'fr';
    else if (base.endsWith('.en')) locale = 'en';
    else throw new Error(`Blog ${file}: filename must end with .fr.mdx or .en.mdx`);
    const slug = base.slice(0, -3);

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
      .sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt))
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

  function getAlternateLocales(slug: string): { fr: boolean; en: boolean } {
    return {
      fr: fs.existsSync(path.join(contentDir, `${slug}.fr.mdx`)),
      en: fs.existsSync(path.join(contentDir, `${slug}.en.mdx`)),
    };
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

export const blog = createBlogLoader(path.join(process.cwd(), 'content/blog'));
