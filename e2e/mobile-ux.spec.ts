/**
 * Mobile UX e2e — locks the three mobile fixes:
 *  1. InfoBox "i" popovers render as a readable bottom sheet (portaled),
 *     not an off-screen tooltip.
 *  2. The hero swaps the heavy desktop crawler for the compact mobile one.
 */
import { test, expect } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

test.describe('InfoBox bottom sheet (mobile)', () => {
  test('opens as a centered, readable modal', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/e2e/report');
    await page.getByRole('button', { name: 'Aide' }).first().click();

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(/Lexique/i)).toBeVisible();

    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Near-full width (viewport 390 minus 16px gutters each side ≈ 358).
      expect(box.width).toBeGreaterThan(320);
      // Vertically centered (not a bottom sheet) and fully on-screen.
      const centerY = box.y + box.height / 2;
      expect(centerY).toBeGreaterThan(MOBILE.height * 0.35);
      expect(centerY).toBeLessThan(MOBILE.height * 0.65);
      expect(box.x).toBeGreaterThanOrEqual(8);
      expect(box.x + box.width).toBeLessThanOrEqual(MOBILE.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(MOBILE.height + 1);
    }
  });

  test('closes on scrim tap', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/e2e/report');
    await page.getByRole('button', { name: 'Aide' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Tap the dimmed scrim near the top, away from the bottom sheet.
    await page.mouse.click(195, 80);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Report tab rail scroll affordance (mobile)', () => {
  test('shows a "more" hint that clears once scrolled to the end', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/e2e/report');
    const hint = page.locator('.rv-railHint');
    await expect(hint).toBeVisible();
    // Scroll the rail fully right → the hint should go away.
    await page.locator('nav.rv-mainNav').evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(hint).toHaveCount(0);
  });

  test('clicking the hint cap scrolls the rail to reveal more tabs', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/e2e/report');
    const rail = page.locator('nav.rv-mainNav');
    const before = await rail.evaluate((el) => el.scrollLeft);
    await page.locator('.rv-railHint').click();
    await page.waitForTimeout(500); // smooth scroll
    const after = await rail.evaluate((el) => el.scrollLeft);
    expect(after).toBeGreaterThan(before);
  });

  test('no scroll hint on desktop (rail is a vertical list)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/e2e/report');
    await expect(page.locator('.rv-railHint')).toHaveCount(0);
  });
});

test('night mode is off on mobile: dark toggle hidden on phone, shown on desktop', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await expect(page.locator('.sa-dark-toggle')).toBeHidden();

  await page.setViewportSize(DESKTOP);
  await expect(page.locator('.sa-dark-toggle')).toBeVisible();
});

test('page declares a light color-scheme (no OS dark-mode bleed)', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  expect(scheme).toBe('light');
});

test.describe('Hero crawler animation swap', () => {
  test('mobile shows the compact crawler, hides the desktop one', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await expect(page.locator('.hero-aside-mobile')).toBeVisible();
    await expect(page.locator('.hero-aside-desktop')).toBeHidden();
  });

  test('desktop shows the full crawler, hides the compact one', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.locator('.hero-aside-desktop')).toBeVisible();
    await expect(page.locator('.hero-aside-mobile')).toBeHidden();
  });
});
