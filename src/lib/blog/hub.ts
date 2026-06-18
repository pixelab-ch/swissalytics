import 'server-only';
import type { Article, ArticleMeta, ArticleType, Author, Block, Locale } from './types';
import { ARTICLE_TYPES, isValidArticleSlug } from './types';
import { bodyToPlainText } from './blocks';

// The CMS hub (Payload) serves every site's articles from one REST API, scoped by `site`.
// This module is the ONLY place that talks to it; the loader composes it with the fs source.
const SITE = 'swissalytics';

// Time-based ISR: published content refreshes hourly without a per-publish webhook.
// (Webhook-driven /api/revalidate is a later phase; this keeps the hub from being hit
// on every request while still picking up edits.)
const REVALIDATE_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 8000;

/** Normalized hub base URL, or null when PAYLOAD_URL is unset (→ fs-only mode). */
export function hubBase(): string | null {
  const u = process.env.PAYLOAD_URL?.trim();
  return u ? u.replace(/\/+$/, '') : null;
}

export function isHubEnabled(): boolean {
  return hubBase() !== null;
}

function originOf(base: string): string {
  try {
    return new URL(base).origin;
  } catch {
    return base;
  }
}

/** Resolve a possibly-relative media path to an absolute URL on the hub origin. */
export function absoluteMediaUrl(raw: unknown, base: string): string | undefined {
  const url = typeof raw === 'string' ? raw : isRecord(raw) && typeof raw.url === 'string' ? raw.url : '';
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) return url;
  return `${originOf(base)}${url.startsWith('/') ? '' : '/'}${url}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (typeof item === 'string') return item;
      if (isRecord(item)) return str(item.tag ?? item.name ?? item.value ?? item.title);
      return '';
    })
    .filter(Boolean);
}

function coerceType(t: unknown): ArticleType {
  return (ARTICLE_TYPES as readonly string[]).includes(str(t)) ? (t as ArticleType) : 'authority';
}

function mapAuthor(raw: unknown, base: string): Author {
  const a = isRecord(raw) ? raw : {};
  return {
    key: str(a.slug) || 'pixelab',
    name: str(a.name) || 'Pixelab',
    role: str(a.role),
    avatar: absoluteMediaUrl(a.avatar, base) ?? '',
    url: str(a.url) || str(a.linkedin) || '',
  };
}

/** Coerce a hub `body` into Block[], resolving media URLs inside image blocks to absolute
 *  so React components stay env-free. Non-array bodies degrade to an empty block list. */
export function normalizeBody(raw: unknown, base: string): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((b) => {
    const block: Block = { ...(b as Record<string, unknown>), blockType: str(b.blockType) };
    if (block.blockType === 'image') {
      const media = isRecord(b.image) ? b.image : undefined;
      block.src = absoluteMediaUrl(b.image ?? b.url ?? b.src, base);
      block.width = typeof media?.width === 'number' ? media.width : undefined;
      block.height = typeof media?.height === 'number' ? media.height : undefined;
      block.alt = str(b.alt) || str(media?.alt) || undefined;
    }
    return block;
  });
}

/** Reading time: trust the hub's value, else estimate from the body (lazy — only
 *  normalizes the body when the hub didn't supply a count). */
function readingMinutesOf(doc: Record<string, unknown>, base: string): number {
  if (typeof doc.readingMinutes === 'number' && doc.readingMinutes > 0) return Math.round(doc.readingMinutes);
  const words = bodyToPlainText(normalizeBody(doc.body, base)).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Map a hub doc to ArticleMeta. `locale`, when given, is forced (the query already
 *  filters by it) instead of trusting the returned field. */
export function mapMeta(doc: Record<string, unknown>, base: string, locale?: Locale): ArticleMeta {
  return {
    slug: str(doc.slug),
    locale: locale ?? (str(doc.locale) as Locale),
    title: str(doc.title),
    description: str(doc.description),
    publishedAt: str(doc.publishedAt) || str(doc.createdAt),
    updatedAt: str(doc.articleUpdatedAt) || str(doc.updatedAt) || undefined,
    type: coerceType(doc.type),
    author: mapAuthor(doc.author, base),
    tags: strArray(doc.tags),
    entities: strArray(doc.entities),
    featured: Boolean(doc.featured),
    draft: str(doc._status) !== '' && str(doc._status) !== 'published',
    readingMinutes: readingMinutesOf(doc, base),
    coverImage: absoluteMediaUrl(doc.coverImage, base),
    coverAlt: str(doc.coverAlt) || undefined,
    coverCaption: str(doc.coverCaption) || undefined,
  };
}

export function mapArticle(doc: Record<string, unknown>, base: string, locale?: Locale): Article {
  return { ...mapMeta(doc, base, locale), body: normalizeBody(doc.body, base) };
}

/** Build a hub REST URL with where-clauses. In draft mode we drop the published filter
 *  and ask Payload for the draft version (auth required to see unpublished docs). */
function articlesUrl(base: string, params: Record<string, string>, draft = false): string {
  const sp = new URLSearchParams({ 'where[site][equals]': SITE, depth: '2', ...params });
  if (draft) sp.set('draft', 'true');
  else sp.set('where[_status][equals]', 'published');
  return `${base}/api/articles?${sp.toString()}`;
}

/** Authenticated header for reading drafts (Payload API-Key scheme). */
function authHeader(): Record<string, string> {
  const key = process.env.PAYLOAD_API_KEY?.trim();
  return key ? { Authorization: `users API-Key ${key}` } : {};
}

/** Run a hub GET that never throws: any failure (no PAYLOAD_URL, network, non-200,
 *  bad JSON) resolves to `fallback`, so the build always falls back to the fs source. */
async function safeHub<T>(run: (base: string) => Promise<T>, fallback: T): Promise<T> {
  const base = hubBase();
  if (!base) return fallback;
  try {
    return await run(base);
  } catch {
    return fallback;
  }
}

async function getDocs(
  url: string,
  opts: { headers?: Record<string, string>; noStore?: boolean } = {},
): Promise<Record<string, unknown>[]> {
  const res = await fetch(url, {
    headers: { accept: 'application/json', ...opts.headers },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // Drafts must never be cached/ISR'd (preview must show the latest edit);
    // published reads are ISR'd hourly.
    ...(opts.noStore ? { cache: 'no-store' as const } : { next: { revalidate: REVALIDATE_SECONDS } }),
  });
  if (!res.ok) throw new Error(`hub ${res.status}`);
  const json = (await res.json()) as { docs?: unknown };
  return Array.isArray(json.docs) ? (json.docs.filter(isRecord) as Record<string, unknown>[]) : [];
}

export function fetchArticles(locale: Locale): Promise<ArticleMeta[]> {
  return safeHub(async (base) => {
    const docs = await getDocs(
      articlesUrl(base, { 'where[locale][equals]': locale, limit: '200', sort: '-publishedAt' }),
    );
    // Drop docs whose slug isn't a safe route (reserved locale prefix, non-kebab, …) —
    // the hub is an external source and these would poison generateStaticParams.
    return docs.map((d) => mapMeta(d, base, locale)).filter((m) => isValidArticleSlug(m.slug));
  }, []);
}

export function fetchArticleBySlug(slug: string, locale: Locale, draft = false): Promise<Article | null> {
  return safeHub<Article | null>(async (base) => {
    const docs = await getDocs(
      articlesUrl(base, { 'where[locale][equals]': locale, 'where[slug][equals]': slug, limit: '1' }, draft),
      draft ? { headers: authHeader(), noStore: true } : {},
    );
    if (!docs[0]) return null;
    const a = mapArticle(docs[0], base, locale);
    return isValidArticleSlug(a.slug) ? a : null;
  }, null);
}

/** Which locales of a slug exist in the hub — used to build hreflang alternates. */
export function fetchArticleLocales(slug: string): Promise<Locale[]> {
  return safeHub<Locale[]>(async (base) => {
    const docs = await getDocs(articlesUrl(base, { 'where[slug][equals]': slug, limit: '10' }));
    return docs.map((d) => str(d.locale) as Locale).filter(Boolean);
  }, []);
}
