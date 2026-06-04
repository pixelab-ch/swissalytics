import { describe, it, expect } from 'vitest';
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildBlogSchema,
  buildFaqPageSchema,
  serializeJsonLd,
} from './schema';
import type { ArticleMeta } from './types';

const meta: ArticleMeta = {
  slug: 'x', locale: 'fr', title: 'T', description: 'D', publishedAt: '2026-01-02',
  type: 'pillar', author: { key: 'p', name: 'Pixelab', role: 'Agence', avatar: '/a.webp', url: 'https://pixelab.ch' },
  tags: [], entities: [], featured: false, draft: false, readingMinutes: 4,
};

describe('blog JSON-LD', () => {
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
});

describe('serializeJsonLd', () => {
  it('escapes < so </script> cannot break out, without escaping spaces', () => {
    const out = serializeJsonLd({ t: 'a </script> b c' });
    expect(out).toContain('\\u003c/script>');
    expect(out).not.toContain('</script>');
    // normal spaces must remain intact (regression guard against escaping them)
    expect(out).toContain('a \\u003c/script> b c');
  });

  it('escapes U+2028 / U+2029 line separators', () => {
    const out = serializeJsonLd({ t: `x${String.fromCharCode(0x2028)}y${String.fromCharCode(0x2029)}z` });
    expect(out).toContain('x\\u2028y\\u2029z');
  });
});
