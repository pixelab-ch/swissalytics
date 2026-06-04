/**
 * E3b — Content e2e tests.
 *
 * - /glossaire returns 200
 * - /guide-geo returns 200
 * - Footer has NO "API" or "Changelog" link text
 * - Journal article in EN shows an English body (contentEn)
 */
import { test, expect } from '@playwright/test';

test.describe('Static content pages — HTTP 200', () => {
  test('/glossaire returns 200', async ({ page }) => {
    const response = await page.goto('/glossaire');
    expect(response?.status()).toBe(200);
    // Also verify the page has visible content (not a blank render)
    await expect(page.getByText(/glossaire|glossary/i).first()).toBeVisible();
  });

  test('/guide-geo returns 200', async ({ page }) => {
    const response = await page.goto('/guide-geo');
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/guide.*geo|geo.*guide/i).first()).toBeVisible();
  });
});

test.describe('Footer — no API or Changelog link', () => {
  test('footer does not contain "API" as a link or list item on the homepage', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // "API" should not appear as a standalone nav/list link in the footer
    // We check the text content of all footer links/list items
    const footerLinks = footer.locator('a, li');
    const texts = await footerLinks.allTextContents();
    const hasApi = texts.some((t) => t.trim().toUpperCase() === 'API');
    expect(hasApi).toBe(false);
  });

  test('footer does not contain "Changelog" as a link or list item on the homepage', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    const footerLinks = footer.locator('a, li');
    const texts = await footerLinks.allTextContents();
    const hasChangelog = texts.some((t) => /changelog/i.test(t.trim()));
    expect(hasChangelog).toBe(false);
  });
});

test.describe('Blog — per-locale article bodies', () => {
  /**
   * The slug 'comment-chatgpt-choisit-ses-sources' has both `content` (FR)
   * and `contentEn` (EN) in posts.ts. The article page picks `contentEn`
   * when the site language is EN.
   *
   * Language toggle: the ThemeProvider stores `lang` in localStorage as
   * 'en'. We set it before navigation to simulate the EN site state.
   */
  const SLUG = 'comment-chatgpt-choisit-ses-sources';

  test('journal article displays EN body when lang=en', async ({ page }) => {
    // EN articles live at their own server-rendered URL (per-locale routing).
    await page.goto(`/blog/en/${SLUG}`);

    // Wait for the article body to render (the main article element in the body)
    await page.waitForSelector('article');

    // The EN lead for this post mentions "400 questions" — this phrase appears
    // in both FR and EN leads. Check for an EN-specific phrase instead.
    // EN content has "What came out was surprising" or "we asked ChatGPT" phrasing
    // FR content has "on a posé 400 questions à ChatGPT"
    // The pickContent() function uses contentEn when lang===en.
    // Use .first() to avoid strict-mode error when related article <article> elements
    // are also in the DOM.
    const articleBody = page.locator('article').first();
    const bodyText = await articleBody.textContent();

    // Check for known EN-specific text from contentEn in posts.ts
    // The EN h2 is "What barely matters" vs FR "Ce qui ne compte presque pas"
    // The EN quote is "The site cited #1 by ChatGPT was almost never Google's top result."
    const hasEnContent = bodyText?.includes('What barely matters') ||
      bodyText?.includes('barely matters') ||
      bodyText?.includes('The site cited') ||
      bodyText?.includes('Three signals') ||
      bodyText?.includes('Authoritative source');

    expect(hasEnContent).toBe(true);
  });

  test('journal article displays FR body by default (no lang set)', async ({ page }) => {
    // Clear any stored lang preference (ThemeProvider uses key 'sa_lang')
    await page.goto(`/blog/${SLUG}`);
    await page.waitForSelector('article');

    // Use .first() to avoid strict-mode error when related article <article>
    // elements are also in the DOM.
    const articleBody = page.locator('article').first();
    const bodyText = await articleBody.textContent();

    // FR content specific phrase from posts.ts content blocks
    const hasFrContent = bodyText?.includes('Ce qui ne compte presque pas') ||
      bodyText?.includes('Les trois signaux') ||
      bodyText?.includes('PageRank');

    expect(hasFrContent).toBe(true);
  });
});
