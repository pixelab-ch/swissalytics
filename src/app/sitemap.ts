import type { MetadataRoute } from 'next';
import { blog } from '@/lib/blog/loader';
import { COMPARE_PAGES } from '@/lib/compare/pages';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://swissalytics.com';
  const now = new Date();

  // ── Static editorial / product pages ──
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

  // ── Blog articles (per locale) ──
  const frEntries: MetadataRoute.Sitemap = blog.listArticles('fr').map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: new Date((p.updatedAt ?? p.publishedAt) + 'T12:00:00Z'),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));
  const enEntries: MetadataRoute.Sitemap = blog.listArticles('en').map((p) => ({
    url: `${baseUrl}/blog/en/${p.slug}`,
    lastModified: new Date((p.updatedAt ?? p.publishedAt) + 'T12:00:00Z'),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // ── Compare pages ──
  const compareEntries: MetadataRoute.Sitemap = COMPARE_PAGES.map((page) => ({
    url: `${baseUrl}/compare/${page.slug}`,
    lastModified: new Date(page.updated + 'T12:00:00Z'),
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }));

  return [...staticEntries, ...frEntries, ...enEntries, ...compareEntries];
}
