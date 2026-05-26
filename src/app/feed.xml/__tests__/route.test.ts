import { describe, it, expect } from 'vitest';
import { GET } from '../route';
import { JOURNAL_POSTS } from '@/lib/journal/posts';

/**
 * GET /feed.xml — RSS 2.0 feed contract.
 *
 * The /journal page advertises this feed, so the route must exist, return
 * valid RSS XML with the correct Content-Type, and include every journal post
 * with a title, link, pubDate and description.
 */
describe('GET /feed.xml', () => {
  it('returns 200 with application/xml Content-Type', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/application\/xml/);
  });

  it('emits a valid RSS 2.0 envelope', async () => {
    const xml = await GET().text();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
    // self-referencing atom link
    expect(xml).toContain('https://swissalytics.com/feed.xml');
  });

  it('includes one <item> per journal post', async () => {
    const xml = await GET().text();
    const itemCount = (xml.match(/<item>/g) ?? []).length;
    expect(itemCount).toBe(JOURNAL_POSTS.length);
    expect(itemCount).toBeGreaterThan(0);
  });

  it('includes title, link, pubDate and description for every post', async () => {
    const xml = await GET().text();
    for (const post of JOURNAL_POSTS) {
      expect(xml).toContain(`https://swissalytics.com/journal/${post.slug}`);
    }
    expect(xml).toContain('<title>');
    expect(xml).toContain('<link>');
    expect(xml).toContain('<pubDate>');
    expect(xml).toContain('<description>');
  });

  it('escapes XML-significant characters so the feed stays well-formed', async () => {
    const xml = await GET().text();
    // No raw unescaped ampersands (every & must be an entity like &amp;).
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it('lists posts newest-first', async () => {
    const xml = await GET().text();
    const sorted = [...JOURNAL_POSTS].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const firstSlugInFeed = sorted[0].slug;
    const lastSlugInFeed = sorted[sorted.length - 1].slug;
    expect(xml.indexOf(firstSlugInFeed)).toBeLessThan(xml.indexOf(lastSlugInFeed));
  });
});
