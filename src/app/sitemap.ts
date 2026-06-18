import type { MetadataRoute } from 'next';
import { blog } from '@/lib/blog/loader';
import { articleDate, blogBase, LOCALES } from '@/lib/blog/types';
import { COMPARE_PAGES } from '@/lib/compare/pages';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://swissalytics.com';
  const now = new Date();

  // ── Static editorial / product pages ──
  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/methode`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/exemples`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/a-propos`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/compare`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/mentions-legales`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // ── Blog index per locale ──
  const blogIndexEntries: MetadataRoute.Sitemap = LOCALES.map((l) => ({
    url: `${baseUrl}${blogBase(l)}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: l === 'fr' ? 0.8 : 0.6,
  }));

  // ── Blog articles per locale (hub + fs) ──
  const perLocale = await Promise.all(
    LOCALES.map(async (l) =>
      (await blog.listArticles(l)).map((p) => ({
        url: `${baseUrl}${blogBase(l)}/${p.slug}`,
        lastModified: articleDate(p.updatedAt ?? p.publishedAt),
        changeFrequency: 'monthly' as const,
        priority: l === 'fr' ? 0.7 : 0.6,
      })),
    ),
  );
  const articleEntries: MetadataRoute.Sitemap = perLocale.flat();

  // ── Compare pages ──
  const compareEntries: MetadataRoute.Sitemap = COMPARE_PAGES.map((page) => ({
    url: `${baseUrl}/compare/${page.slug}`,
    lastModified: new Date(page.updated + 'T12:00:00Z'),
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }));

  return [...staticEntries, ...blogIndexEntries, ...articleEntries, ...compareEntries];
}
