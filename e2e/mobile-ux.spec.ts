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
    // Right cap only (the left cap also carries .rv-railHint).
    const rightCap = page.locator('.rv-railHint:not(.rv-railHint-l)');
    await expect(rightCap).toBeVisible();
    // Scroll the rail fully right → the right hint should go away.
    await page.locator('nav.rv-mainNav').evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(rightCap).toHaveCount(0);
  });

  test('clicking the right cap scrolls forward; a left cap then appears and scrolls back', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/e2e/report');
    const rail = page.locator('nav.rv-mainNav');

    // No left cap at the start (already at scrollLeft 0).
    await expect(page.locator('.rv-railHint-l')).toHaveCount(0);

    // Click the right cap → scrolls forward. force:true avoids actionability
    // flake from the cap's infinite "nudge" transform animation.
    const start = await rail.evaluate((el) => el.scrollLeft);
    const rightCap = page.locator('.rv-railHint:not(.rv-railHint-l)');
    await expect(rightCap).toBeVisible();
    await rightCap.click({ force: true });
    await page.waitForTimeout(500);
    const mid = await rail.evaluate((el) => el.scrollLeft);
    expect(mid).toBeGreaterThan(start);

    // Now a left cap exists → click it scrolls back.
    const leftCap = page.locator('.rv-railHint-l');
    await expect(leftCap).toBeVisible();
    await leftCap.click({ force: true });
    await page.waitForTimeout(500);
    const back = await rail.evaluate((el) => el.scrollLeft);
    expect(back).toBeLessThan(mid);
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
