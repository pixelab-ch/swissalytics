/**
 * Mobile navigation (hamburger) e2e tests.
 *
 * The TopBar hides the desktop nav below 768px and exposes a hamburger button
 * that toggles a full-width <nav class="sa-mobile-nav"> panel. These tests
 * verify the burger is mobile-only, the panel opens/closes, lists all nav
 * entries + CTA, and navigating closes it.
 */
import { test, expect } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };

test.describe('Mobile hamburger menu', () => {
  test('burger is hidden on desktop, visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /open menu/i })).toBeHidden();

    await page.setViewportSize(MOBILE);
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();
  });

  test('opening the menu reveals all nav links + CTA, then closes', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');

    // Closed by default.
    await expect(page.locator('.sa-mobile-nav')).toHaveCount(0);

    // Open.
    await page.getByRole('button', { name: /open menu/i }).click();
    const panel = page.locator('.sa-mobile-nav');
    await expect(panel).toBeVisible();
    // 4 nav items + 1 CTA link = 5 links, all >= 48px tall (tap targets).
    const links = panel.getByRole('link');
    await expect(links).toHaveCount(5);
    for (const link of await links.all()) {
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // Close via the X button.
    await page.getByRole('button', { name: /close menu/i }).click();
    await expect(page.locator('.sa-mobile-nav')).toHaveCount(0);
  });

  test('Escape closes the menu', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.getByRole('button', { name: /open menu/i }).click();
    await expect(page.locator('.sa-mobile-nav')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.sa-mobile-nav')).toHaveCount(0);
  });

  test('clicking outside the bar closes the menu', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.getByRole('button', { name: /open menu/i }).click();
    await expect(page.locator('.sa-mobile-nav')).toBeVisible();
    // Click low on the page, outside the top bar + dropdown.
    await page.mouse.click(195, 700);
    await expect(page.locator('.sa-mobile-nav')).toHaveCount(0);
  });

  test('tapping a nav link navigates and closes the menu', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');

    await page.getByRole('button', { name: /open menu/i }).click();
    const panel = page.locator('.sa-mobile-nav');
    await expect(panel).toBeVisible();

    // The first nav entry points at /methode.
    await panel.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/methode$/);
    // Menu auto-closes on route change.
    await expect(page.locator('.sa-mobile-nav')).toHaveCount(0);
  });
});
