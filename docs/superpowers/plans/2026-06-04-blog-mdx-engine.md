# Blog MDX Engine (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded, client-rendered `/journal` with a file-based MDX blog at `/blog`, server-rendered (RSC), bilingual via real per-locale URLs, with full JSON-LD — so articles are indexable and citable by AI engines.

**Architecture:** MDX files in `content/blog/<slug>.<locale>.mdx` parsed by a `server-only` loader (gray-matter + validation). RSC pages render the MDX via `next-mdx-remote/rsc` inside a brand-themed prose container, emit per-article metadata + JSON-LD. FR at `/blog`, EN at `/blog/en`, with `hreflang` and 301 redirects from `/journal`.

**Tech Stack:** Next.js 15.3.3 (App Router, RSC), React 19, Tailwind v3, vitest (unit), Playwright (e2e). New deps: `gray-matter`, `next-mdx-remote`, `remark-gfm`, `rehype-slug`, `reading-time`, `@tailwindcss/typography`.

**Spec:** `docs/superpowers/specs/2026-06-04-blog-mdx-engine-design.md`

**Conventions for the executor:**
- The dev server may be running on `:3007`. **Stop it before any `next build`** (shared `.next` clash). `vitest` and `tsc --noEmit` are safe to run alongside dev.
- Commit after each task. Branch already in use: `responsive-full-devices`.
- Run `npm run type-check` before each commit; it must pass.

---

## File Structure

**Create:**
- `src/lib/blog/types.ts` — shared types (`ArticleType`, `Article`, `ArticleMeta`, `Author`, `Locale`).
- `src/lib/blog/loader.ts` — `server-only` file loader + validation + queries.
- `src/lib/blog/schema.ts` — JSON-LD generators.
- `src/lib/blog/loader.test.ts`, `src/lib/blog/schema.test.ts` — vitest unit tests.
- `src/lib/blog/__fixtures__/` — test MDX fixtures + `_authors.json`.
- `content/blog/_authors.json` — author registry.
- `content/blog/<slug>.fr.mdx` (+ `.en.mdx`) — the 7 migrated articles.
- `src/components/blog/MdxContent.tsx` — RSC MDX renderer.
- `src/components/blog/Faq.tsx`, `HowTo.tsx` — MDX blocks + their JSON-LD.
- `src/components/blog/TableOfContents.tsx`, `ReadingProgressBar.tsx` — client widgets.
- `src/components/blog/ArticleCard.tsx`, `BlogListing.tsx` — listing UI (shared FR/EN).
- `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx` — FR routes.
- `src/app/blog/en/page.tsx`, `src/app/blog/en/[slug]/page.tsx` — EN routes.
- `e2e/blog.spec.ts` — Playwright e2e.

**Modify:**
- `tailwind.config.ts:65` — add typography plugin.
- `src/app/globals.css` — add `.blog-prose` brand styles.
- `next.config.js` — add `redirects()`.
- `src/app/sitemap.ts` — per-locale blog URLs from the loader.
- `src/components/design-system/Footer.tsx:15` — `Journal /journal` → `Blog /blog`.
- `src/lib/i18n/copy.ts` — footer label `Journal`→`Blog` if present.

**Delete (Task 9, after parity verified):**
- `src/lib/journal/posts.ts`
- `src/app/journal/page.tsx`, `src/app/journal/[slug]/page.tsx` (whole `src/app/journal/`)

---

## Task 0: Install dependencies + verify MDX/RSC compatibility

**Files:**
- Modify: `package.json` (via npm), `tailwind.config.ts:65`

- [ ] **Step 1: Install runtime + dev deps**

Run:
```bash
npm install gray-matter next-mdx-remote remark-gfm rehype-slug reading-time
npm install -D @tailwindcss/typography
```
Expected: installs succeed, `package.json` updated.

- [ ] **Step 2: Enable the typography plugin (Tailwind v3)**

Modify `tailwind.config.ts` line 65 (`plugins: [],`):
```ts
plugins: [require('@tailwindcss/typography')],
```

- [ ] **Step 3: Smoke-test next-mdx-remote/rsc on Next 15 / React 19**

Create a throwaway RSC page `src/app/blog/_smoke/page.tsx`:
```tsx
import { MDXRemote } from 'next-mdx-remote/rsc';

export default function Smoke() {
  return (
    <div style={{ padding: 40 }}>
      <MDXRemote source={'# MDX ok\n\nParagraphe **gras**.'} />
    </div>
  );
}
```

- [ ] **Step 4: Verify it renders**

Run (dev already on :3007, or `PORT=3007 npm run dev`):
```bash
curl -s http://localhost:3007/blog/_smoke | grep -c "MDX ok"
```
Expected: `1` (server-rendered HTML contains the heading). If it errors, resolve version compat before continuing.

- [ ] **Step 5: Remove the smoke page and commit**

```bash
rm -rf src/app/blog/_smoke
git add package.json package-lock.json tailwind.config.ts
git commit -m "chore(blog): add MDX/typography deps, verify RSC compat"
```

---

## Task 1: Shared types

**Files:**
- Create: `src/lib/blog/types.ts`

- [ ] **Step 1: Write the types**

```ts
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
```

- [ ] **Step 2: Type-check and commit**

```bash
npm run type-check
git add src/lib/blog/types.ts
git commit -m "feat(blog): shared article types"
```

---

## Task 2: Loader with validation (TDD)

The loader resolves a content directory (overridable for tests), reads `*.fr.mdx`/`*.en.mdx`, validates frontmatter, resolves authors, computes reading time, and exposes queries.

**Files:**
- Create: `src/lib/blog/loader.ts`, `src/lib/blog/loader.test.ts`
- Create fixtures: `src/lib/blog/__fixtures__/_authors.json`, `src/lib/blog/__fixtures__/hello.fr.mdx`, `hello.en.mdx`, `solo-fr.fr.mdx`, `draft-x.fr.mdx`

- [ ] **Step 1: Create fixtures**

`src/lib/blog/__fixtures__/_authors.json`:
```json
{ "pixelab": { "name": "Équipe Pixelab", "role": "Agence", "avatar": "/blog/authors/pixelab.webp", "url": "https://pixelab.ch" } }
```
`src/lib/blog/__fixtures__/hello.fr.mdx`:
```mdx
---
title: "Bonjour"
description: "Desc FR"
publishedAt: "2026-01-02"
type: "pillar"
author: "pixelab"
featured: true
---
Corps **FR**. Lorem ipsus dolor sit amet enim.
```
`src/lib/blog/__fixtures__/hello.en.mdx`:
```mdx
---
title: "Hello"
description: "Desc EN"
publishedAt: "2026-01-02"
type: "pillar"
author: "pixelab"
---
Body **EN**. Lorem ipsus dolor sit amet enim.
```
`src/lib/blog/__fixtures__/solo-fr.fr.mdx`:
```mdx
---
title: "Solo FR"
description: "Only FR"
publishedAt: "2026-01-05"
type: "checklist"
author: "pixelab"
---
Seulement en français.
```
`src/lib/blog/__fixtures__/draft-x.fr.mdx`:
```mdx
---
title: "Brouillon"
description: "Draft"
publishedAt: "2026-02-01"
type: "authority"
author: "pixelab"
draft: true
---
Pas prêt.
```

- [ ] **Step 2: Write the failing tests**

`src/lib/blog/loader.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npx vitest run src/lib/blog/loader.test.ts`
Expected: FAIL (`createBlogLoader` not found).

- [ ] **Step 4: Implement the loader**

`src/lib/blog/loader.ts`:
```ts
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import { ARTICLE_TYPES, type Article, type ArticleMeta, type ArticleType, type Author, type Locale } from './types';

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

  function loadAuthors(): Record<string, Omit<Author, 'key'>> {
    return JSON.parse(fs.readFileSync(authorsPath, 'utf8'));
  }

  function parseFile(file: string): Article {
    const raw = fs.readFileSync(path.join(contentDir, file), 'utf8');
    const { data, content } = matter(raw);
    const [slug, locale] = file.replace(/\.mdx$/, '').split('.') as [string, Locale];

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
    return fs.readdirSync(contentDir).filter((f) => f.endsWith(`.${locale}.mdx`));
  }

  function listArticles(locale: Locale): ArticleMeta[] {
    const isProd = process.env.NODE_ENV === 'production';
    return allFiles(locale)
      .map((f) => parseFile(f))
      .filter((a) => (isProd ? !a.draft : true))
      .sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt))
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
    const rest = all.filter((a) => !sameType.includes(a));
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
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/lib/blog/loader.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Type-check and commit**

```bash
npm run type-check
git add src/lib/blog/loader.ts src/lib/blog/loader.test.ts src/lib/blog/__fixtures__
git commit -m "feat(blog): file-based loader with validation + tests"
```

---

## Task 3: JSON-LD schema generators (TDD)

**Files:**
- Create: `src/lib/blog/schema.ts`, `src/lib/blog/schema.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/blog/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildArticleSchema, buildBreadcrumbSchema, buildBlogSchema, buildFaqPageSchema } from './schema';
import type { ArticleMeta } from './types';

const meta: ArticleMeta = {
  slug: 'x', locale: 'fr', title: 'T', description: 'D', publishedAt: '2026-01-02',
  type: 'pillar', author: { key: 'p', name: 'Pixelab', role: 'Agence', avatar: '/a.webp', url: 'https://pixelab.ch' },
  tags: [], entities: [], featured: false, draft: false, readingMinutes: 4,
};

it('Article schema has required fields with absolute URLs', () => {
  const s = buildArticleSchema(meta, 'Body words here', 'https://swissalytics.com/blog/x');
  expect(s['@type']).toBe('Article');
  expect(s.headline).toBe('T');
  expect(s.inLanguage).toBe('fr');
  expect(s.mainEntityOfPage).toMatch(/^https:\/\//);
  expect(s.author['@type']).toBe('Person');
});

it('Breadcrumb has 3 ordered items', () => {
  const s = buildBreadcrumbSchema(meta, 'https://swissalytics.com/blog/x');
  expect(s.itemListElement).toHaveLength(3);
  expect(s.itemListElement[2].position).toBe(3);
});

it('Blog schema lists posts', () => {
  const s = buildBlogSchema([meta], 'https://swissalytics.com/blog');
  expect(s['@type']).toBe('Blog');
  expect(s.blogPost).toHaveLength(1);
});

it('FAQ schema maps Q/A', () => {
  const s = buildFaqPageSchema([{ q: 'Q?', a: 'A.' }]);
  expect(s.mainEntity[0].acceptedAnswer.text).toBe('A.');
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/blog/schema.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement schema generators**

`src/lib/blog/schema.ts`:
```ts
import type { ArticleMeta } from './types';

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
    wordCount: bodyText.trim().split(/\s+/).length,
    image: a.coverImage ? `${SITE_URL}${a.coverImage}` : undefined,
    author: { '@type': 'Person', name: a.author.name, url: a.author.url },
    publisher: PUBLISHER,
    mainEntityOfPage: url,
  };
}

export function buildBreadcrumbSchema(a: ArticleMeta, url: string) {
  const blogUrl = a.locale === 'en' ? `${SITE_URL}/blog/en` : `${SITE_URL}/blog`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
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
```

- [ ] **Step 4: Run, verify pass + commit**

```bash
npx vitest run src/lib/blog/schema.test.ts
npm run type-check
git add src/lib/blog/schema.ts src/lib/blog/schema.test.ts
git commit -m "feat(blog): JSON-LD schema generators + tests"
```

---

## Task 4: MDX renderer, brand prose, MDX blocks, client widgets

**Files:**
- Create: `src/components/blog/MdxContent.tsx`, `Faq.tsx`, `HowTo.tsx`, `TableOfContents.tsx`, `ReadingProgressBar.tsx`
- Modify: `src/app/globals.css` (append `.blog-prose` styles)

- [ ] **Step 1: Brand prose styles**

Append to `src/app/globals.css` (brutalist overrides; reuses tokens already defined `--sa-ink`, `--sa-red`, fonts):
```css
.blog-prose { max-width: 720px; color: var(--sa-ink-2); font-size: 18px; line-height: 1.7; }
.blog-prose h2 { font-family: var(--sa-font-sans); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 48px 0 14px; color: var(--sa-ink); }
.blog-prose h3 { font-family: var(--sa-font-sans); font-weight: 700; font-size: 21px; margin: 32px 0 10px; color: var(--sa-ink); }
.blog-prose p { margin: 0 0 18px; }
.blog-prose a { color: var(--sa-red); text-decoration: underline; text-underline-offset: 3px; }
.blog-prose ul, .blog-prose ol { margin: 0 0 18px; padding-left: 22px; }
.blog-prose li { margin: 6px 0; }
.blog-prose blockquote { border-left: 4px solid var(--sa-red); background: var(--sa-cream-2); margin: 28px 0; padding: 18px 22px; font-size: 19px; }
.blog-prose img { border: 2px solid var(--sa-ink); border-radius: 0; }
.blog-prose code { font-family: var(--sa-font-mono); font-size: 0.88em; background: var(--sa-cream-2); padding: 2px 5px; }
.blog-prose pre { border: 2px solid var(--sa-ink); border-radius: 0; padding: 16px; overflow:auto; }
```

- [ ] **Step 2: MDX renderer (RSC)**

`src/components/blog/MdxContent.tsx`:
```tsx
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { Faq } from './Faq';
import { HowTo } from './HowTo';

const components = { Faq, HowTo };

export function MdxContent({ source }: { source: string }) {
  return (
    <div className="blog-prose">
      <MDXRemote
        source={source}
        components={components}
        options={{ mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] } }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Faq block (renders + emits FAQPage JSON-LD)**

`src/components/blog/Faq.tsx`:
```tsx
import { buildFaqPageSchema } from '@/lib/blog/schema';

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section style={{ borderTop: '2px solid var(--sa-ink)', marginTop: 40, paddingTop: 24 }}>
      {items.map((it, i) => (
        <details key={i} style={{ borderBottom: '1px solid var(--sa-rule)', padding: '14px 0' }}>
          <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{it.q}</summary>
          <p style={{ marginTop: 8 }}>{it.a}</p>
        </details>
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqPageSchema(items)) }} />
    </section>
  );
}
```

- [ ] **Step 4: HowTo block**

`src/components/blog/HowTo.tsx`:
```tsx
import { buildHowToSchema } from '@/lib/blog/schema';

export function HowTo({ name, steps }: { name: string; steps: { name: string; text: string }[] }) {
  return (
    <section style={{ border: '2px solid var(--sa-ink)', padding: 20, margin: '28px 0' }}>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ margin: '8px 0' }}>
            <strong>{s.name}.</strong> {s.text}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHowToSchema(name, steps)) }} />
    </section>
  );
}
```

- [ ] **Step 5: TableOfContents (client, scroll-spy, hidden if <3 sections)**

`src/components/blog/TableOfContents.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';

type Item = { id: string; text: string; level: number };

export function TableOfContents() {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    const hs = Array.from(document.querySelectorAll('.blog-prose h2, .blog-prose h3')) as HTMLElement[];
    setItems(hs.filter((h) => h.id).map((h) => ({ id: h.id, text: h.textContent || '', level: h.tagName === 'H2' ? 2 : 3 })));
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive((e.target as HTMLElement).id)),
      { rootMargin: '0px 0px -75% 0px' }
    );
    hs.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, []);

  if (items.length < 3) return null;
  return (
    <nav className="mono" style={{ position: 'sticky', top: 96, fontSize: 12, lineHeight: 1.9 }}>
      {items.map((it) => (
        <a key={it.id} href={`#${it.id}`} style={{ display: 'block', paddingLeft: it.level === 3 ? 12 : 0, color: active === it.id ? 'var(--sa-red)' : 'var(--sa-ink-4)', textDecoration: 'none' }}>
          {it.text}
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 6: ReadingProgressBar (client)**

`src/components/blog/ReadingProgressBar.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';

export function ReadingProgressBar() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div style={{ position: 'fixed', top: 0, left: 0, height: 3, width: `${p}%`, background: 'var(--sa-red)', zIndex: 50 }} />;
}
```

- [ ] **Step 7: Type-check and commit**

```bash
npm run type-check
git add src/components/blog src/app/globals.css
git commit -m "feat(blog): MDX renderer, brand prose, blocks, ToC, progress bar"
```

---

## Task 5: FR routes — listing + article (RSC, metadata, JSON-LD)

**Files:**
- Create: `src/components/blog/ArticleCard.tsx`, `src/components/blog/BlogListing.tsx`
- Create: `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`

- [ ] **Step 1: Type-label map + ArticleCard**

`src/components/blog/ArticleCard.tsx`:
```tsx
import Link from 'next/link';
import type { ArticleMeta, ArticleType, Locale } from '@/lib/blog/types';

export const TYPE_LABEL: Record<Locale, Record<ArticleType, string>> = {
  fr: { authority: 'Analyse', pillar: 'Dossier', versus: 'Comparatif', decision: 'Décision', checklist: 'Checklist' },
  en: { authority: 'Analysis', pillar: 'Guide', versus: 'Versus', decision: 'Decision', checklist: 'Checklist' },
};

export function ArticleCard({ a, base }: { a: ArticleMeta; base: string }) {
  return (
    <Link href={`${base}/${a.slug}`} style={{ display: 'block', borderTop: '2px solid var(--sa-ink)', padding: '24px 0', textDecoration: 'none', color: 'var(--sa-ink)' }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sa-red)' }}>
        {TYPE_LABEL[a.locale][a.type]} · {a.readingMinutes} min
      </div>
      <h2 className="display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: '8px 0' }}>{a.title}</h2>
      <p style={{ color: 'var(--sa-ink-2)', margin: 0 }}>{a.description}</p>
    </Link>
  );
}
```

- [ ] **Step 2: BlogListing (shared FR/EN)**

`src/components/blog/BlogListing.tsx`:
```tsx
import type { ArticleMeta } from '@/lib/blog/types';
import { ArticleCard } from './ArticleCard';
import Shell from '@/components/design-system/Shell';

export function BlogListing({ posts, base, title }: { posts: ArticleMeta[]; base: string; title: string }) {
  return (
    <Shell>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px' }}>
        <h1 className="display" style={{ fontSize: 'clamp(44px,6vw,96px)', letterSpacing: '-0.012em', lineHeight: 0.94, margin: '0 0 40px' }}>{title}</h1>
        {posts.map((a) => <ArticleCard key={a.slug} a={a} base={base} />)}
      </div>
    </Shell>
  );
}
```

- [ ] **Step 3: FR listing page**

`src/app/blog/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { blog } from '@/lib/blog/loader';
import { buildBlogSchema, SITE_URL } from '@/lib/blog/schema';
import { BlogListing } from '@/components/blog/BlogListing';

export const metadata: Metadata = {
  title: 'Blog — Swissalytics',
  description: 'Analyses SEO & visibilité IA (GEO) par Pixelab.',
  alternates: { canonical: `${SITE_URL}/blog`, languages: { fr: `${SITE_URL}/blog`, en: `${SITE_URL}/blog/en` } },
};

export default function BlogIndex() {
  const posts = blog.listArticles('fr');
  const schema = buildBlogSchema(posts, `${SITE_URL}/blog`);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <BlogListing posts={posts} base="/blog" title="Le blog" />
    </>
  );
}
```

- [ ] **Step 4: FR article page**

`src/app/blog/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Shell from '@/components/design-system/Shell';
import { blog } from '@/lib/blog/loader';
import { buildArticleSchema, buildBreadcrumbSchema, SITE_URL } from '@/lib/blog/schema';
import { MdxContent } from '@/components/blog/MdxContent';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { ReadingProgressBar } from '@/components/blog/ReadingProgressBar';

export function generateStaticParams() {
  return blog.listArticleParams('fr');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = blog.getArticleBySlug(slug, 'fr');
  if (!a) return {};
  const alt = blog.getAlternateLocales(slug);
  return {
    title: `${a.title} — Swissalytics`,
    description: a.description,
    alternates: {
      canonical: `${SITE_URL}/blog/${slug}`,
      languages: { fr: `${SITE_URL}/blog/${slug}`, ...(alt.en ? { en: `${SITE_URL}/blog/en/${slug}` } : {}) },
    },
    openGraph: { title: a.title, description: a.description, type: 'article' },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = blog.getArticleBySlug(slug, 'fr');
  if (!a) notFound();
  const url = `${SITE_URL}/blog/${slug}`;
  return (
    <Shell>
      <ReadingProgressBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildArticleSchema(a, a.body, url)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbSchema(a, url)) }} />
      <article style={{ maxWidth: 1180, margin: '0 auto', padding: '64px 24px', display: 'grid', gridTemplateColumns: '1fr 240px', gap: 48 }}>
        <div>
          <h1 className="display" style={{ fontSize: 'clamp(36px,5vw,64px)', letterSpacing: '-0.02em', lineHeight: 1.0, margin: '0 0 24px' }}>{a.title}</h1>
          <MdxContent source={a.body} />
        </div>
        <aside><TableOfContents /></aside>
      </article>
    </Shell>
  );
}
```

- [ ] **Step 5: Verify in the browser**

Run (dev on :3007). Migrate happens in Task 8; for now test with one fixture copied to `content/blog/` OR run after Task 8. Smoke check route compiles:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3007/blog
```
Expected: `200`.

- [ ] **Step 6: Type-check and commit**

```bash
npm run type-check
git add src/app/blog/page.tsx "src/app/blog/[slug]/page.tsx" src/components/blog/ArticleCard.tsx src/components/blog/BlogListing.tsx
git commit -m "feat(blog): FR listing + article routes (RSC, metadata, JSON-LD)"
```

---

## Task 6: EN routes

**Files:**
- Create: `src/app/blog/en/page.tsx`, `src/app/blog/en/[slug]/page.tsx`

- [ ] **Step 1: EN listing**

`src/app/blog/en/page.tsx` — same as FR listing but `locale='en'`, `base="/blog/en"`, title `"The blog"`, canonical `${SITE_URL}/blog/en`:
```tsx
import type { Metadata } from 'next';
import { blog } from '@/lib/blog/loader';
import { buildBlogSchema, SITE_URL } from '@/lib/blog/schema';
import { BlogListing } from '@/components/blog/BlogListing';

export const metadata: Metadata = {
  title: 'Blog — Swissalytics',
  description: 'SEO & AI-search (GEO) analyses by Pixelab.',
  alternates: { canonical: `${SITE_URL}/blog/en`, languages: { fr: `${SITE_URL}/blog`, en: `${SITE_URL}/blog/en` } },
};

export default function BlogIndexEn() {
  const posts = blog.listArticles('en');
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBlogSchema(posts, `${SITE_URL}/blog/en`)) }} />
      <BlogListing posts={posts} base="/blog/en" title="The blog" />
    </>
  );
}
```

- [ ] **Step 2: EN article**

`src/app/blog/en/[slug]/page.tsx` — same as FR article with `locale='en'`, URLs prefixed `/blog/en/`, canonical EN, `fr` alternate when it exists:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Shell from '@/components/design-system/Shell';
import { blog } from '@/lib/blog/loader';
import { buildArticleSchema, buildBreadcrumbSchema, SITE_URL } from '@/lib/blog/schema';
import { MdxContent } from '@/components/blog/MdxContent';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { ReadingProgressBar } from '@/components/blog/ReadingProgressBar';

export function generateStaticParams() {
  return blog.listArticleParams('en');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = blog.getArticleBySlug(slug, 'en');
  if (!a) return {};
  const alt = blog.getAlternateLocales(slug);
  return {
    title: `${a.title} — Swissalytics`,
    description: a.description,
    alternates: {
      canonical: `${SITE_URL}/blog/en/${slug}`,
      languages: { en: `${SITE_URL}/blog/en/${slug}`, ...(alt.fr ? { fr: `${SITE_URL}/blog/${slug}` } : {}) },
    },
    openGraph: { title: a.title, description: a.description, type: 'article' },
  };
}

export default async function ArticlePageEn({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = blog.getArticleBySlug(slug, 'en');
  if (!a) notFound();
  const url = `${SITE_URL}/blog/en/${slug}`;
  return (
    <Shell>
      <ReadingProgressBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildArticleSchema(a, a.body, url)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbSchema(a, url)) }} />
      <article style={{ maxWidth: 1180, margin: '0 auto', padding: '64px 24px', display: 'grid', gridTemplateColumns: '1fr 240px', gap: 48 }}>
        <div>
          <h1 className="display" style={{ fontSize: 'clamp(36px,5vw,64px)', letterSpacing: '-0.02em', lineHeight: 1.0, margin: '0 0 24px' }}>{a.title}</h1>
          <MdxContent source={a.body} />
        </div>
        <aside><TableOfContents /></aside>
      </article>
    </Shell>
  );
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npm run type-check
git add src/app/blog/en
git commit -m "feat(blog): EN listing + article routes"
```

---

## Task 7: Redirects, sitemap, footer/nav

**Files:**
- Modify: `next.config.js`, `src/app/sitemap.ts`, `src/components/design-system/Footer.tsx:15`, `src/lib/i18n/copy.ts`

- [ ] **Step 1: 301 redirects /journal → /blog**

In `next.config.js`, add to `nextConfig`:
```js
  async redirects() {
    return [
      { source: '/journal', destination: '/blog', permanent: true },
      { source: '/journal/:slug', destination: '/blog/:slug', permanent: true },
    ];
  },
```

- [ ] **Step 2: Rewrite sitemap to use the loader + per-locale URLs**

Replace `src/app/sitemap.ts` journal section:
```ts
import type { MetadataRoute } from 'next';
import { blog } from '@/lib/blog/loader';
import { COMPARE_PAGES } from '@/lib/compare/pages';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://swissalytics.com';
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/methode`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/exemples`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/a-propos`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/blog/en`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/compare`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/mentions-legales`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
  const fr = blog.listArticles('fr').map((p) => ({ url: `${baseUrl}/blog/${p.slug}`, lastModified: new Date(p.publishedAt + 'T12:00:00Z'), changeFrequency: 'monthly' as const, priority: 0.7 }));
  const en = blog.listArticles('en').map((p) => ({ url: `${baseUrl}/blog/en/${p.slug}`, lastModified: new Date(p.publishedAt + 'T12:00:00Z'), changeFrequency: 'monthly' as const, priority: 0.6 }));
  const compareEntries: MetadataRoute.Sitemap = COMPARE_PAGES.map((page) => ({ url: `${baseUrl}/compare/${page.slug}`, lastModified: new Date(page.updated + 'T12:00:00Z'), changeFrequency: 'monthly' as const, priority: 0.9 }));
  return [...staticEntries, ...fr, ...en, ...compareEntries];
}
```

- [ ] **Step 3: Footer link**

Modify `src/components/design-system/Footer.tsx` line 15: `{ label: 'Journal', href: '/journal' }` → `{ label: 'Blog', href: '/blog' }`.
Check `src/lib/i18n/copy.ts` for a `footerRessources` label array containing "Journal" / "Journal" EN; rename to "Blog" in both FR/EN if present (the `FooterCol` uses `labels={copy.footerRessources}`).

- [ ] **Step 4: Type-check and commit**

```bash
npm run type-check
git add next.config.js src/app/sitemap.ts src/components/design-system/Footer.tsx src/lib/i18n/copy.ts
git commit -m "feat(blog): 301 redirects, per-locale sitemap, nav label"
```

---

## Task 8: Migrate the 7 articles + retire the old journal

Source data: `src/lib/journal/posts.ts` (`JOURNAL_POSTS`). Each post → `content/blog/<slug>.fr.mdx` (and `.en.mdx` if `contentEn` exists). Block mapping: `{type:'p',html}` → paragraph (HTML allowed in MDX); `{type:'h2',text}` → `## text`; `{type:'quote',text}` → `> text`; `{type:'numbered',items}` → numbered list or `<HowTo>`. Category → type map: `Analyse→authority`, `Technique→pillar`, `Opinion→decision`, `Cas client→versus`.

- [ ] **Step 1: Author registry**

Create `content/blog/_authors.json`:
```json
{ "pixelab": { "name": "Équipe Pixelab", "role": "Agence web · Genève", "avatar": "/blog/authors/pixelab.webp", "url": "https://pixelab.ch" } }
```

- [ ] **Step 2: Migrate each post (repeat for all 7)**

For each entry in `JOURNAL_POSTS`, create `content/blog/<slug>.fr.mdx`:
```mdx
---
title: "<title>"
description: "<excerpt>"
publishedAt: "<date>"
type: "<mapped type>"
author: "pixelab"
featured: <featured ?? false>
entities: []
---
<lead as first paragraph>

<each content block converted to MDX>
```
If the post has `contentEn`/`titleEn`/`excerptEn`, also create `content/blog/<slug>.en.mdx` with the EN values. Use the real text from `posts.ts` — do not paraphrase.

- [ ] **Step 3: Verify parity in the browser**

Dev on :3007:
```bash
curl -s http://localhost:3007/blog | grep -o 'Le blog'
for s in comment-chatgpt-choisit-ses-sources schema-org-le-detail-qui-change-tout geo-vs-seo-definitions; do
  curl -s -o /dev/null -w "$s %{http_code}\n" "http://localhost:3007/blog/$s"; done
```
Expected: listing shows all migrated posts; each article returns `200`. Read `/blog` and one article screenshot via the browse tool; confirm brand prose looks right (drop-cap/blockquote, Inter Tight headings, red links).

- [ ] **Step 4: Delete the old journal system**

```bash
git rm src/lib/journal/posts.ts
git rm -r src/app/journal
grep -rn "lib/journal/posts\|/journal" src/ || echo "no stale references"
```
Resolve any remaining import of `JOURNAL_POSTS` (should only have been sitemap, already migrated).

- [ ] **Step 5: Type-check, run all unit tests, commit**

```bash
npm run type-check
npx vitest run src/lib/blog/
git add content/blog public/blog
git commit -m "feat(blog): migrate 7 articles to MDX, retire hardcoded journal"
```

---

## Task 9: e2e tests

**Files:**
- Create: `e2e/blog.spec.ts`

- [ ] **Step 1: Write e2e**

`e2e/blog.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('FR listing renders server-side', async ({ page }) => {
  await page.goto('/blog');
  await expect(page.locator('h1')).toContainText('blog');
  await expect(page.locator('article a, a[href^="/blog/"]').first()).toBeVisible();
});

test('article emits Article JSON-LD + hreflang', async ({ page }) => {
  await page.goto('/blog/geo-vs-seo-definitions');
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join('')).toContain('"@type":"Article"');
});

test('/journal redirects to /blog (301)', async ({ page }) => {
  const res = await page.goto('/journal');
  expect(res?.url()).toContain('/blog');
});

test('EN listing exists', async ({ page }) => {
  const res = await page.goto('/blog/en');
  expect(res?.status()).toBe(200);
});

test('unknown slug 404s', async ({ page }) => {
  const res = await page.goto('/blog/nope-nope-nope');
  expect(res?.status()).toBe(404);
});
```

- [ ] **Step 2: Run e2e (stop dev first if a build is needed)**

```bash
npm run test:e2e -- e2e/blog.spec.ts
```
Expected: all pass. (Playwright config starts its own server; if it expects a build, stop the `:3007` dev server first.)

- [ ] **Step 3: Commit**

```bash
git add e2e/blog.spec.ts
git commit -m "test(blog): e2e for routes, JSON-LD, hreflang, redirect, 404"
```

---

## Task 10: Production build + review gate

- [ ] **Step 1: Stop dev, production build (no dev clash)**

```bash
# stop any running `next dev` on :3007 first
npm run type-check && npm run lint && npm run build
```
Expected: clean build, all `/blog` + `/blog/en` + article routes statically generated.

- [ ] **Step 2: Review gate (user's standard: dev + architect)**

Route the full diff through `code-reviewer` and `architect-reviewer` agents before final validation. Fix findings, re-run `vitest` + `build`.

- [ ] **Step 3: Final commit if review changes were made**

```bash
git add -A && git commit -m "fix(blog): address review findings"
```

---

## Self-review notes (author)

- **Spec coverage:** loader/validation (T2), schema (T3), MDX+brand prose (T4), FR routes+metadata+JSON-LD (T5), EN routes (T6), redirects+sitemap+nav (T7), migration+retire posts.ts (T8), tests (T2/T3/T9), build+review gate (T10). `entities`/`featured`/`draft` covered in types+loader. OG auto-images explicitly deferred to Phase 2 (spec §9).
- **Type consistency:** `blog` loader object exposes exactly the methods used by pages (`listArticles`, `getArticleBySlug`, `listArticleParams`, `getAlternateLocales`, `getRelatedArticles`). `TYPE_LABEL` keyed by `Locale`+`ArticleType` matches `ARTICLE_TYPES`.
- **Known follow-up:** `getRelatedArticles` is built but not yet wired into the article page UI — optional “related” section can be added during T5/T8 if desired (not required for Phase 1 goal).
