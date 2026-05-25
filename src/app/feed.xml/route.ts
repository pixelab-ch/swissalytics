import { JOURNAL_POSTS } from '@/lib/journal/posts';

/**
 * RSS 2.0 feed for the Journal.
 *
 * The /journal page advertises `/feed.xml` ("No newsletter, just an RSS feed"),
 * so this route generates a valid feed from the static journal posts. Served
 * with `Content-Type: application/xml`.
 */

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

/** ISO date string → RFC 822 date required by RSS pubDate. */
function toRfc822(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString();
}

export function GET(): Response {
  // Newest first.
  const posts = [...JOURNAL_POSTS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const lastBuildDate = posts.length > 0 ? toRfc822(posts[0].date) : new Date().toUTCString();

  const items = posts
    .map((post) => {
      const link = `${SITE_URL}/journal/${post.slug}`;
      return [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${toRfc822(post.date)}</pubDate>`,
        `      <category>${escapeXml(post.category)}</category>`,
        `      <description>${escapeXml(post.excerpt)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Swissalytics — Journal</title>
    <link>${SITE_URL}/journal</link>
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
