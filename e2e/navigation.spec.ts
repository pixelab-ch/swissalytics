/**
 * E2 — Navigation e2e tests.
 *
 * Tests the report view navigation:
 * 1. Clicking the 4 left-rail main tabs changes content AND the ?tab= URL param.
 * 2. Clicking the 6 Détails sub-sections (horizontal bar) changes the active section.
 *
 * Uses the e2e fixture route /e2e/report (guarded by E2E=1 env var set in
 * playwright.config.ts webServer command).
 */
import { test, expect } from '@playwright/test';

const FIXTURE_URL = '/e2e/report';

test.describe('Left-rail main tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE_URL);
    // Wait for the report to be rendered (the gauge/score strip is always present)
    await page.waitForSelector('[role="tablist"]');
  });

  test('default tab is overview — no ?tab= in URL', async ({ page }) => {
    const url = new URL(page.url());
    expect(url.searchParams.get('tab')).toBeNull();
    // Overview content: "Pour info" stat cards section is visible
    await expect(page.getByText(/Pour info — chiffres bruts/i)).toBeVisible();
  });

  test('clicking Détails tab sets ?tab=details and shows sub-section bar', async ({ page }) => {
    // Find and click the Détails tab button in the tablist
    const tablist = page.locator('[role="tablist"]');
    await tablist.getByRole('tab', { name: /d[eé]tails/i }).click();

    // URL should have ?tab=details
    await expect(page).toHaveURL(/[?&]tab=details/);

    // The Détails sub-section nav should be visible (contains section buttons)
    // Look for the horizontal nav with section labels like "Structure sémantique"
    await expect(page.getByText(/Structure s[eé]mantique/i)).toBeVisible();
  });

  test('clicking Plan tab sets ?tab=plan and shows action plan content', async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');
    await tablist.getByRole('tab', { name: /plan|action/i }).click();

    await expect(page).toHaveURL(/[?&]tab=plan/);

    // Plan content: should show one of the bucket labels (Critique or Important)
    await expect(page.getByText(/Critique|Priorit/i).first()).toBeVisible();
  });

  test('clicking GEO tab sets ?tab=geo and shows geo content', async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');
    await tablist.getByRole('tab', { name: /geo|indexation/i }).click();

    await expect(page).toHaveURL(/[?&]tab=geo/);

    // GEO tab shows the bot coverage section (§10 header)
    await expect(page.getByText(/Robots IA/i)).toBeVisible();
  });

  test('clicking back to overview removes ?tab= from URL', async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');

    // Go to details first
    await tablist.getByRole('tab', { name: /d[eé]tails/i }).click();
    await expect(page).toHaveURL(/[?&]tab=details/);

    // Click the overview tab (§01)
    await tablist.getByRole('tab', { name: /tableau de bord|overview/i }).click();
    // Wait for the URL to update — router.replace is async
    // Overview removes the ?tab= param, so we expect the URL NOT to contain ?tab=
    await page.waitForFunction(() => !new URL(window.location.href).searchParams.has('tab'));
    const url = new URL(page.url());
    expect(url.searchParams.get('tab')).toBeNull();
  });
});

test.describe('Détails sub-section horizontal bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE_URL);
    // Navigate to Détails tab first
    const tablist = page.locator('[role="tablist"]');
    await tablist.getByRole('tab', { name: /d[eé]tails/i }).click();
    await expect(page).toHaveURL(/[?&]tab=details/);
    // Wait for sub-section nav to appear
    await page.waitForSelector('nav', { timeout: 5000 });
  });

  test('default sub-section is headings (Structure sémantique)', async ({ page }) => {
    // The first sub-section (headings / Structure sémantique) should be active
    await expect(page.getByText(/Structure s[eé]mantique/i)).toBeVisible();
    // Headings tab content: "H1" mention
    await expect(page.getByText(/H1/i).first()).toBeVisible();
  });

  test('clicking Images sub-section changes to images content', async ({ page }) => {
    // Find and click the Images section in the sub-section nav
    // The sub-section nav is NOT the main tablist, it's a secondary nav
    const subNav = page.locator('nav').nth(1);
    await subNav.getByText(/images/i).click();
    // Images tab content should appear
    await expect(page.getByText(/18/)).toBeVisible(); // total: 18 in fixture
  });

  test('clicking Liens sub-section changes section', async ({ page }) => {
    const subNav = page.locator('nav').nth(1);
    await subNav.getByText(/liens/i).click();
    // Links tab content
    await expect(page.getByText(/34/).first()).toBeVisible(); // total links: 34 in fixture
  });

  test('clicking Performance technique sub-section changes section', async ({ page }) => {
    const subNav = page.locator('nav').nth(1);
    await subNav.getByText(/Performance|technique/i).click();
    // Technical tab shows HTTPS or robots.txt info
    await expect(page.getByText(/HTTPS|robots/i).first()).toBeVisible();
  });

  test('clicking Métadonnées sub-section changes section', async ({ page }) => {
    const subNav = page.locator('nav').nth(1);
    await subNav.getByText(/[Mm][eé]tadonn/i).click();
    // Metadata tab content: OG or Twitter mention
    await expect(page.getByText(/og:|twitter:|og\s+title|open graph/i).first()).toBeVisible();
  });

  test('clicking Lisibilité sub-section changes section', async ({ page }) => {
    const subNav = page.locator('nav').nth(1);
    await subNav.getByText(/lisibilit/i).click();
    // Readability tab: Flesch or word count
    await expect(page.getByText(/flesch|lisibilit|mots/i).first()).toBeVisible();
  });
});
