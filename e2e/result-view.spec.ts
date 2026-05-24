/**
 * E3a — Result view e2e tests.
 *
 * Asserts on the rendered ReportView fixture:
 * - Overview leads with Critique/Important/Bonus grouping ABOVE the raw stat cards
 * - Scorecards show a qualifier word and no stuck "···"
 * - Bot-coverage panel visible in the GEO tab
 */
import { test, expect } from '@playwright/test';

const FIXTURE_URL = '/e2e/report';

test.describe('Overview — plan grouping above stat cards', () => {
  test('Critique / Important / Bonus buckets are present and above stat cards', async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForSelector('[role="tablist"]');

    // The overview is the default tab — check bucket sections are visible.
    // The label uses a typographic apostrophe (U+2019) in "d'abord" so we
    // match the word "abord" directly to avoid any encoding ambiguity.
    // All three bucket headers are rendered as "§NN · <label> · <count>" in a
    // single span, so we match on the label word appearing anywhere in the text.
    await expect(page.getByText(/Critique\s*·\s*à faire d.abord|Critical\s*·\s*do this first/i)).toBeVisible();
    await expect(page.getByText(/§02\s*·\s*Important/i).first()).toBeVisible();
    await expect(page.getByText(/§03\s*·\s*Bonus/i).first()).toBeVisible();

    // The "Pour info — chiffres bruts" label must exist and come AFTER the plan buckets
    await expect(page.getByText(/Pour info — chiffres bruts|For info — raw figures/i)).toBeVisible();

    // Verify DOM order: the plan bucket section appears before the stat cards section
    const pageContent = await page.content();
    const critIndex = pageContent.search(/Critique/i);
    const statCardIndex = pageContent.search(/Pour info — chiffres bruts|For info — raw figures/i);
    expect(critIndex).toBeGreaterThan(0);
    expect(statCardIndex).toBeGreaterThan(0);
    expect(critIndex).toBeLessThan(statCardIndex);
  });

  test('"Voir le plan" button is visible and switches to plan tab when clicked', async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForSelector('[role="tablist"]');

    // Match both straight and typographic apostrophes in "plan d'action"
    const planBtn = page.getByRole('button', { name: /plan d.action|action plan/i });
    await expect(planBtn).toBeVisible();
    await planBtn.click();

    // Should now show plan tab content
    await expect(page).toHaveURL(/[?&]tab=plan/);
  });
});

test.describe('Scorecards — qualifier word + no stuck loading', () => {
  test('all 4 scorecards show a qualifier word (Solide/Correct/À renforcer/Solid/Fair/Needs work)', async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForSelector('[role="tablist"]');

    // geoAnalysis is present in fixture, so IA-Ready is not loading
    // All 4 scorecards should show one of these qualifier words
    const qualifierPattern = /Solide|Correct|À renforcer|Solid|Fair|Needs work/i;

    // Wait for scorecards to render (they appear immediately since geoAnalysis is in fixture)
    const qualifiers = page.getByText(qualifierPattern);
    // There should be at least 4 qualifier labels (one per scorecard)
    const count = await qualifiers.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('no "···" (stuck loading dots) in the scorecards area', async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForSelector('[role="tablist"]');

    // Give time for any async renders to settle
    await page.waitForTimeout(500);

    // "···" should not appear in the score area — the fixture has geoAnalysis set
    const stuckDots = page.getByText('···');
    const count = await stuckDots.count();
    expect(count).toBe(0);
  });

  test('scorecard numbers are visible (not in loading state)', async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForSelector('[role="tablist"]');

    // The fixture has scores: technical=68, readability=63, geo=58, headings=71
    // All should render as numbers, not "calcul…"
    const calcText = page.getByText(/^calcul[….]?$/i);
    const count = await calcText.count();
    expect(count).toBe(0);
  });
});

test.describe('GEO tab — bot-coverage panel', () => {
  test('bot coverage panel is visible in the GEO tab', async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForSelector('[role="tablist"]');

    // Click GEO tab
    const tablist = page.locator('[role="tablist"]');
    await tablist.getByRole('tab', { name: /geo|indexation/i }).click();
    await expect(page).toHaveURL(/[?&]tab=geo/);

    // The bot coverage panel header
    await expect(page.getByText(/Robots IA \(robots\.txt\)|AI Robots \(robots\.txt\)/i)).toBeVisible();
  });

  test('bot coverage shows GPTBot as blocked with warning', async ({ page }) => {
    await page.goto(FIXTURE_URL);
    const tablist = page.locator('[role="tablist"]');
    await tablist.getByRole('tab', { name: /geo|indexation/i }).click();

    // GPTBot is blocked in the fixture — warning banner should appear
    await expect(page.getByText(/GPTBot/i).first()).toBeVisible();
    await expect(page.getByText(/bloque.*GPTBot|blocks.*GPTBot/i)).toBeVisible();
  });

  test('bot coverage shows Googlebot as allowed', async ({ page }) => {
    await page.goto(FIXTURE_URL);
    const tablist = page.locator('[role="tablist"]');
    await tablist.getByRole('tab', { name: /geo|indexation/i }).click();

    await expect(page.getByText('Googlebot')).toBeVisible();
    // Should have Autorisé / Allowed status for Googlebot
    const googlebotRow = page.locator('li').filter({ hasText: 'Googlebot' });
    await expect(googlebotRow.getByText(/Autorisé|Allowed/i)).toBeVisible();
  });

  test('bot coverage shows "Non mentionné" for ClaudeBot', async ({ page }) => {
    await page.goto(FIXTURE_URL);
    const tablist = page.locator('[role="tablist"]');
    await tablist.getByRole('tab', { name: /geo|indexation/i }).click();

    const claudeRow = page.locator('li').filter({ hasText: 'ClaudeBot' });
    await expect(claudeRow.getByText(/Non mentionné|Not mentioned/i)).toBeVisible();
  });
});
