import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { createBlogLoader } from './loader';

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
  it('reports which locales exist', () => {
    expect(loader.getAlternateLocales('hello')).toEqual({ fr: true, en: true });
    expect(loader.getAlternateLocales('solo-fr')).toEqual({ fr: true, en: false });
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
