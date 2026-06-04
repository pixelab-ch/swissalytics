import { test, expect } from '@playwright/test';

test('FR listing renders server-side with article links', async ({ page }) => {
  await page.goto('/blog');
  await expect(page.locator('h1')).toContainText(/blog/i);
  await expect(page.locator('a[href^="/blog/"]').first()).toBeVisible();
});

test('article emits Article JSON-LD', async ({ page }) => {
  await page.goto('/blog/geo-vs-seo-definitions');
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join('')).toContain('"@type":"Article"');
});

test('/journal redirects to /blog', async ({ page }) => {
  await page.goto('/journal');
  expect(page.url()).toContain('/blog');
});

test('/journal/:slug redirects to /blog/:slug', async ({ page }) => {
  await page.goto('/journal/geo-vs-seo-definitions');
  expect(page.url()).toContain('/blog/geo-vs-seo-definitions');
});

test('EN listing renders at /blog/en', async ({ page }) => {
  const res = await page.goto('/blog/en');
  expect(res?.status()).toBe(200);
  await expect(page.locator('a[href^="/blog/en/"]').first()).toBeVisible();
});

test('unknown slug 404s', async ({ page }) => {
  const res = await page.goto('/blog/nope-nope-nope');
  expect(res?.status()).toBe(404);
});

test('EN article is served with lang="en" in the static HTML', async ({ page }) => {
  await page.goto('/blog/en/geo-vs-seo-definitions');
  await expect(page.locator('article')).toHaveAttribute('lang', 'en');
});

test('FR/EN toggle navigates to the sibling-locale article URL', async ({ page }) => {
  await page.goto('/blog/geo-vs-seo-definitions');
  await page.getByRole('button', { name: 'en', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/en\/geo-vs-seo-definitions$/);
});
