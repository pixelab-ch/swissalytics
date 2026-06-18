import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { createBlogLoader, mergeArticleLists } from './loader';
import { articleDate, type ArticleMeta } from './types';

const FIX = path.join(__dirname, '__fixtures__');
const loader = createBlogLoader(FIX);

describe('listArticles', () => {
  it('returns FR articles sorted by date DESC, drafts hidden in prod', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const fr = loader.listArticles('fr');
    expect(fr.map((a) => a.slug)).toEqual(['solo-fr', 'hello']); // 2026-01-05 then 2026-01-02; draft excluded
    vi.unstubAllEnvs();
  });

  it('shows drafts in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(loader.listArticles('fr').some((a) => a.slug === 'draft-x')).toBe(true);
    vi.unstubAllEnvs();
  });

  it('EN listing only contains articles translated to EN', () => {
    expect(loader.listArticles('en').map((a) => a.slug)).toEqual(['hello']);
  });
});

describe('getArticleBySlug', () => {
  it('returns the full article with body and resolved author', () => {
    const a = loader.getArticleBySlug('hello', 'fr');
    expect(a?.title).toBe('Bonjour');
    expect(a?.author.name).toBe('Équipe Pixelab');
    expect(a?.body).toContain('Corps');
    expect(a?.readingMinutes).toBeGreaterThan(0);
  });
  it('returns null for a missing locale', () => {
    expect(loader.getArticleBySlug('solo-fr', 'en')).toBeNull();
  });
});

describe('getAlternateLocales', () => {
  it('reports which locales exist (all four locales keyed)', () => {
    expect(loader.getAlternateLocales('hello')).toEqual({ fr: true, en: true, de: false, it: false });
    expect(loader.getAlternateLocales('solo-fr')).toEqual({ fr: true, en: false, de: false, it: false });
  });
});

describe('mergeArticleLists', () => {
  const meta = (slug: string, publishedAt: string, title: string): ArticleMeta =>
    ({ slug, publishedAt, title }) as ArticleMeta;

  it('dedupes by slug with the primary (hub) winning', () => {
    const hub = [meta('a', '2026-01-02', 'hub-a')];
    const fs = [meta('a', '2026-01-02', 'fs-a'), meta('b', '2026-01-01', 'fs-b')];
    const merged = mergeArticleLists(hub, fs);
    expect(merged.map((m) => m.slug)).toEqual(['a', 'b']);
    expect(merged.find((m) => m.slug === 'a')?.title).toBe('hub-a');
  });

  it('sorts the merged set by publish date DESC', () => {
    const hub = [meta('new', '2026-03-01', 'n')];
    const fs = [meta('old', '2026-01-01', 'o'), meta('mid', '2026-02-01', 'm')];
    expect(mergeArticleLists(hub, fs).map((m) => m.slug)).toEqual(['new', 'mid', 'old']);
  });

  it('breaks date ties by slug so builds are deterministic', () => {
    const a = [meta('zebra', '2026-01-01', 'z'), meta('alpha', '2026-01-01', 'a')];
    expect(mergeArticleLists(a, []).map((m) => m.slug)).toEqual(['alpha', 'zebra']);
  });
});

describe('articleDate', () => {
  it('parses a bare day (fs/MDX) to noon UTC', () => {
    expect(articleDate('2025-09-08').toISOString()).toBe('2025-09-08T12:00:00.000Z');
  });
  it('parses a full ISO datetime (hub) as-is — no "T...Z" double-suffix bug', () => {
    expect(articleDate('2026-06-04T12:00:00.000Z').toISOString()).toBe('2026-06-04T12:00:00.000Z');
  });
  it('falls back to the epoch on an unparseable value', () => {
    expect(articleDate('not-a-date').getTime()).toBe(0);
  });
});

describe('validation', () => {
  it('rejects a reserved slug "en"', () => {
    expect(() => loader.assertValidSlug('en')).toThrow(/reserved/i);
  });
  it('rejects a non-kebab slug', () => {
    expect(() => loader.assertValidSlug('Not_Kebab')).toThrow(/kebab/i);
  });
});

describe('getRelatedArticles', () => {
  it('prefers same type then recency, excludes self', () => {
    const rel = loader.getRelatedArticles('hello', 'fr', 2);
    expect(rel.find((a) => a.slug === 'hello')).toBeUndefined();
    expect(rel.length).toBeLessThanOrEqual(2);
  });
});

describe('frontmatter fail-fast (build must break, never publish silently)', () => {
  const bad = createBlogLoader(path.join(__dirname, '__fixtures_bad__'));

  it('throws on an invalid `type`', () => {
    expect(() => bad.getArticleBySlug('bad-type', 'fr')).toThrow(/invalid type/i);
  });

  it('throws on an unknown author key', () => {
    expect(() => bad.getArticleBySlug('bad-author', 'fr')).toThrow(/unknown author/i);
  });

  it('throws on a missing required field', () => {
    expect(() => bad.getArticleBySlug('missing-field', 'fr')).toThrow(/missing required frontmatter/i);
  });
});
