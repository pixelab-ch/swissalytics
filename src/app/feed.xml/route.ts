import { blog } from '@/lib/blog/loader';
import type { ArticleType } from '@/lib/blog/types';

/**
 * RSS 2.0 feed for the Blog.
 *
 * The /blog page advertises `/feed.xml` ("No newsletter, just an RSS feed"),
 * so this route generates a valid feed from the FR MDX articles. Served with
 * `Content-Type: application/xml`.
 */

// Generated at build time (reads MDX from the filesystem); no per-request fs work.
export const dynamic = 'force-static';

const SITE_URL = 'https://swissalytics.com';

const TYPE_LABEL_FR: Record<ArticleType, string> = {
  authority: 'Analyse',
  pillar: 'Dossier',
  versus: 'Comparatif',
  decision: 'Décision',
  checklist: 'Checklist',
};

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
  // listArticles already returns newest-first.
  const posts = blog.listArticles('fr');

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
        `      <category>${escapeXml(TYPE_LABEL_FR[post.type])}</category>`,
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
