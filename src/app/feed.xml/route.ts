import { blog } from '@/lib/blog/loader';
import { articleDate, TYPE_LABEL } from '@/lib/blog/types';

/**
 * RSS 2.0 feed for the Blog.
 *
 * The /blog page advertises `/feed.xml` ("No newsletter, just an RSS feed"),
 * so this route generates a valid feed from the FR articles (hub + MDX fallback).
 * Served with `Content-Type: application/xml`.
 */

// Built once then refreshed hourly (ISR) — matches the hub fetch revalidation, so
// newly-published hub articles surface in the feed without a redeploy.
export const revalidate = 3600;

const SITE_URL = 'https://swissalytics.com';

/** Escape the five XML predefined entities so titles/descriptions stay valid. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Article date (bare day or full ISO) → RFC 822 date required by RSS pubDate. */
function toRfc822(value: string): string {
  return articleDate(value).toUTCString();
}

export async function GET(): Promise<Response> {
  // listArticles already returns newest-first.
  const posts = await blog.listArticles('fr');

  const lastBuildDate =
    posts.length > 0 ? toRfc822(posts[0].publishedAt) : new Date().toUTCString();

  const items = posts
    .map((post) => {
      const link = `${SITE_URL}/blog/${post.slug}`;
      return [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${toRfc822(post.publishedAt)}</pubDate>`,
        `      <category>${escapeXml(TYPE_LABEL.fr[post.type])}</category>`,
        `      <description>${escapeXml(post.description)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Swissalytics — Blog</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>SEO &amp; GEO — analyses, technique et cas clients. Pas de newsletter, juste un flux RSS.</description>
    <language>fr-CH</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
