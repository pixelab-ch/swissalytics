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
    await page.locator('nav.rv-mainNav').first().evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(rightCap).toHaveCount(0);
  });

  test('clicking the right cap scrolls forward; a left cap then appears and scrolls back', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/e2e/report');
    const rail = page.locator('nav.rv-mainNav').first();

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

test('image preview modal opens with the media URL and closes', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/e2e/report?tab=details');
  // Switch to the Images & médias sub-section.
  await page.locator('nav').nth(1).getByText(/images/i).first().click();
  const voir = page.getByRole('button', { name: /^Voir$/ }).first();
  await expect(voir).toBeVisible();
  await voir.click();
  const dlg = page.getByRole('dialog', { name: /aper[çc]u/i });
  await expect(dlg).toBeVisible();
  // The source URL is shown and contained (no page overflow).
  await expect(dlg.getByRole('link')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  // Closes on Escape.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /aper[çc]u/i })).toHaveCount(0);
});

test('link preview popup opens with the full URL + open action, then closes', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/e2e/report?tab=details');
  await page.locator('nav').nth(1).getByText(/liens/i).first().click();
  // Tap an external (absolute) link URL → opens the preview popup.
  await page.getByRole('button', { name: /example\.com/ }).first().click();
  const dlg = page.getByRole('dialog', { name: /aper[çc]u du lien/i });
  await expect(dlg).toBeVisible();
  // Absolute URLs get an "Ouvrir le lien" action.
  await expect(dlg.getByRole('link', { name: /ouvrir le lien/i })).toBeVisible();
  // The popup never causes horizontal page overflow.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  // Closes on Escape.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /aper[çc]u du lien/i })).toHaveCount(0);
});

// 360px = common narrow Android width; tighter than the 390 iPhone and the
// width where rigid min-widths (e.g. minmax(320px)) start clipping.
const NARROW = { width: 360, height: 780 };

// Helper: the largest right edge among matched elements must stay within the
// viewport. body is overflow-x:clip, so a too-wide child is *clipped* (looks
// "collé à droite") without growing document.scrollWidth — measure rects.
async function maxRight(page: import('@playwright/test').Page, selector: string) {
  return page.evaluate((sel) => {
    let max = 0;
    document.querySelectorAll(sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width <= window.innerWidth * 1.5) max = Math.max(max, r.right);
    });
    return { max: Math.round(max), vw: window.innerWidth };
  }, selector);
}

test('action plan: long URLs in items wrap inside the card (no right clipping)', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await page.goto('/e2e/report?tab=plan');
  // The fixture seeds an item whose body embeds a long URL (mirrors the real
  // "Image sans attribut alt: https://…" analyzer message).
  await expect(page.getByText(/Image sans attribut alt:/).first()).toBeVisible();
  const { max, vw } = await maxRight(page, '.pb-row *');
  expect(max).toBeLessThanOrEqual(vw + 1);
});

test('details sub-nav is a single segmented grid, fully contained', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await page.goto('/e2e/report?tab=details');
  // .first() — the report tab area double-renders under React 19 concurrent
  // mode (same reason the rv-mainNav test uses .first()).
  const subnav = page.locator('.dc-subnav').first();
  await expect(subnav).toBeVisible();
  // It's a CSS grid (the segmented control), not a wrapped flex.
  expect(await subnav.evaluate((el) => getComputedStyle(el).display)).toBe('grid');
  // All six sub-sections are present as tabs.
  await expect(subnav.getByRole('tab')).toHaveCount(6);
  // No part of it is clipped off the right edge.
  const { max, vw } = await maxRight(page, '.dc-subnav');
  expect(max).toBeLessThanOrEqual(vw + 1);
});

test('images: clicking the source URL (not just "Voir") opens the preview', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/e2e/report?tab=details');
  await page.locator('nav').nth(1).getByText(/images/i).first().click();
  // The src line is itself a button now (mirrors LinksTab) — tapping it opens
  // the same image preview, so the media URL is directly actionable.
  await page.getByRole('button', { name: /swissalytics\.test|\.(png|jpg|svg|webp)/i }).first().click();
  await expect(page.getByRole('dialog', { name: /aper[çc]u/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /aper[çc]u/i })).toHaveCount(0);
});

test('metadata: social previews stay inside the viewport on a narrow phone', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await page.goto('/e2e/report?tab=details');
  await page.locator('nav').nth(1).getByText(/m[ée]tadonn/i).first().click();
  await expect(page.getByText(/Aperçus réseaux sociaux/i)).toBeVisible();
  // Every element in the metadata tab must fit (the social grid used to force
  // a 320px track that overflowed on sub-360px containers).
  const { max, vw } = await maxRight(page, '.v2-tabframe *');
  expect(max).toBeLessThanOrEqual(vw + 1);
});

test('Images problems are compacted into a thumbnail gallery that opens the preview', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/e2e/report?tab=details');
  await page.locator('nav').nth(1).getByText(/images/i).first().click();
  // Per-image problems render as compact thumbnails ("Voir le média"), grouped
  // by reason — not one tall card each. Two missing-alt images → ≥2 thumbs.
  const thumbs = page.getByRole('button', { name: /voir le m[ée]dia/i });
  expect(await thumbs.count()).toBeGreaterThanOrEqual(2);
  // Clicking a thumbnail opens the rich image preview (shows the source link).
  await thumbs.first().click();
  await expect(page.getByRole('dialog', { name: /aper[çc]u de l['’]image/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /aper[çc]u de l['’]image/i })).toHaveCount(0);
});

test('problematic media is previewable from the action plan', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/e2e/report?tab=plan');
  const seeMedia = page.getByRole('button', { name: /voir le m[ée]dia/i }).first();
  await expect(seeMedia).toBeVisible();
  await seeMedia.click();
  await expect(page.getByRole('dialog', { name: /aper[çc]u du m[ée]dia/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /aper[çc]u du m[ée]dia/i })).toHaveCount(0);
});

test('action plan: a native issue (broken link) is not printed as title AND subtitle', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/e2e/report?tab=plan');
  // The broken-link message must appear exactly once in its item (title only),
  // not duplicated into the subtitle.
  await expect(page.getByText(/marqueur-e2e/)).toHaveCount(1);
});

test('overview: no top-priority item repeats its message as title AND subtitle', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/e2e/report');
  // The overview shows only the top-3 items, so the broken link may not appear;
  // but if it does, it must never be duplicated (title + identical subtitle).
  expect(await page.getByText(/marqueur-e2e/).count()).toBeLessThanOrEqual(1);
  // And no native crit item duplicates its title into a subtitle: assert the
  // first overview item's title text isn't immediately repeated underneath it.
  const dupCount = await page.evaluate(() => {
    let dups = 0;
    document.querySelectorAll('p').forEach((p) => {
      const next = p.nextElementSibling;
      if (next && next.tagName === 'P' && p.textContent && p.textContent.trim() === next.textContent?.trim()) dups++;
    });
    return dups;
  });
  expect(dupCount).toBe(0);
});

test('Flesch scale: stacked legend on mobile, original numeric ticks on desktop', async ({ page }) => {
  // Mobile → legend shown, desktop ticks hidden.
  await page.setViewportSize(MOBILE);
  await page.goto('/e2e/report?tab=details');
  await page.locator('nav').nth(1).getByText(/lisibilit/i).first().click();
  await expect(page.locator('.rt-scale-mobile')).toBeVisible();
  await expect(page.locator('.rt-scale-desktop')).toBeHidden();
  // Desktop → original ticks shown, legend hidden (desktop layout untouched).
  await page.setViewportSize(DESKTOP);
  await expect(page.locator('.rt-scale-desktop')).toBeVisible();
  await expect(page.locator('.rt-scale-mobile')).toBeHidden();
});

test('mobile footer: no arrow on Pixelab, Geneva dedication shown', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  const footer = page.locator('.sa-footer-mobile');
  await expect(footer).toBeVisible();
  const txt = await footer.innerText();
  expect(txt).not.toContain('↗'); // arrow removed from "Pixelab"
  expect(txt).toMatch(/Gen[èe]v/i); // "Créé à Genève" dedication
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
