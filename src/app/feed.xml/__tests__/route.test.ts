import { describe, it, expect } from 'vitest';
import { GET } from '../route';
import { blog } from '@/lib/blog/loader';

/**
 * GET /feed.xml — RSS 2.0 feed contract.
 *
 * The /blog page advertises this feed, so the route must exist, return valid
 * RSS XML with the correct Content-Type, and include every FR blog article
 * with a title, link, pubDate and description.
 */
describe('GET /feed.xml', () => {
  const posts = blog.listArticles('fr');

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
    expect(xml).toContain('https://swissalytics.com/feed.xml');
  });

  it('includes one <item> per FR blog article', async () => {
    const xml = await GET().text();
    const itemCount = (xml.match(/<item>/g) ?? []).length;
    expect(itemCount).toBe(posts.length);
    expect(itemCount).toBeGreaterThan(0);
  });

  it('includes title, link, pubDate and description for every post', async () => {
    const xml = await GET().text();
    for (const post of posts) {
      expect(xml).toContain(`https://swissalytics.com/blog/${post.slug}`);
    }
    expect(xml).toContain('<title>');
    expect(xml).toContain('<link>');
    expect(xml).toContain('<pubDate>');
    expect(xml).toContain('<description>');
  });

  it('escapes XML-significant characters so the feed stays well-formed', async () => {
    const xml = await GET().text();
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it('lists posts newest-first', async () => {
    const xml = await GET().text();
    const firstSlugInFeed = posts[0].slug;
    const lastSlugInFeed = posts[posts.length - 1].slug;
    expect(xml.indexOf(firstSlugInFeed)).toBeLessThan(xml.indexOf(lastSlugInFeed));
  });
});
