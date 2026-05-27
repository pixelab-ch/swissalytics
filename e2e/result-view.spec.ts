/**
 * E3a — Result view e2e tests.
 *
 * Asserts on the rendered ReportView fixture:
 * - Overview is the "cockpit": top-3 priorities, AI visibility, strengths,
 *   technical preview — each block teasing one tab. NOT the full plan list.
 * - The full grouped Crit/Important/Bonus list lives on the Plan tab, with
 *   explicit effort labels.
 * - Scorecards show a qualifier word and no stuck "···"
 * - Bot-coverage panel visible in the GEO tab
 * - Async cockpit blocks (AI engines, LCP) show calm skeletons (?state=loading)
 */
import { test, expect } from '@playwright/test';

const FIXTURE_URL = '/e2e/report';

test.describe('Overview — cockpit dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForSelector('[role="tablist"]');
  });

  test('§01 — top-3 priority block with severity badges (not the full list)', async ({ page }) => {
    // The cockpit priority section header.
    await expect(page.getByText(/À corriger en priorité|Fix first/i)).toBeVisible();

    // The cockpit shows ONLY the top 3 — numbered 01/02/03 in the priority
    // frame. The grouped bucket headers ("§NN · Critique · N") must NOT appear
    // on the overview (those moved to the Plan tab).
    await expect(page.getByText(/Critique\s*·\s*à faire/i)).toHaveCount(0);

    // A severity badge is present in the priority rows. FR renders "Crit."
    // (with period, M3), EN renders "Crit".
    await expect(page.getByText(/^Crit\.?$/i).first()).toBeVisible();
  });

  test('§02 — AI visibility block: "X / N" + engine chips + robots-IA line', async ({ page }) => {
    await expect(page.getByText(/Visibilité IA|AI visibility/i)).toBeVisible();

    // geoAnalysis present → honest "X / N" count renders. The 4 canonical
    // engines are all tested + non-errored in the default fixture → "/ 4".
    await expect(page.getByText(/\/\s*4/).first()).toBeVisible();
    await expect(page.getByText(/moteurs te citent|engines cite you/i)).toBeVisible();

    // Engine chips (fixture: gemini+claude indexed, chatgpt+mistral not).
    await expect(page.getByText(/ChatGPT/).first()).toBeVisible();
    await expect(page.getByText(/Mistral/).first()).toBeVisible();

    // Robots-IA line reuses bot-coverage; GPTBot is blocked in the fixture.
    await expect(page.getByText(/Robots IA|AI robots/i)).toBeVisible();
    // Blocked AI bot warning.
    await expect(page.getByText(/GPTBot.*bloqué|GPTBot.*blocked/i).first()).toBeVisible();
  });

  test('§03 — Strengths block with green-check signals', async ({ page }) => {
    await expect(page.getByText(/Points forts|Strengths/i)).toBeVisible();
    // HTTPS is active + no mixed content in the fixture → a strength.
    await expect(page.getByText(/HTTPS actif|HTTPS active/i)).toBeVisible();
  });

  test('§04 — Technical overview block with 4 stat cells + "all details" link', async ({ page }) => {
    await expect(page.getByText(/Aperçu technique|Technical overview/i)).toBeVisible();
    // Images cell flags "8 sans alt" (fixture withoutAlt=8) in red.
    await expect(page.getByText(/8 sans alt|8 without alt/i)).toBeVisible();
  });

  test('"Voir le plan complet (N)" link switches to the plan tab', async ({ page }) => {
    const planBtn = page.getByRole('button', { name: /plan d.action complet|full action plan/i });
    await expect(planBtn).toBeVisible();
    await planBtn.click();
    await expect(page).toHaveURL(/[?&]tab=plan/);
  });

  test('"Détail IA →" link switches to the geo tab', async ({ page }) => {
    const geoBtn = page.getByRole('button', { name: /Détail IA|AI detail/i });
    await expect(geoBtn).toBeVisible();
    await geoBtn.click();
    await expect(page).toHaveURL(/[?&]tab=geo/);
  });
});

test.describe('Plan tab — full grouped list with explicit effort labels', () => {
  test('shows Crit/Important/Bonus buckets and a localized effort label', async ({ page }) => {
    await page.goto(`${FIXTURE_URL}?tab=plan`);
    await page.waitForSelector('[role="tablist"]');

    // The full grouped list lives here (bucket headers "§NN · <label> · N").
    await expect(page.getByText(/Critique|Critical/i).first()).toBeVisible();

    // Explicit effort labels replace the bare S/M/L codes.
    await expect(
      page.getByText(/Effort faible|Effort moyen|Effort élevé|Low effort|Medium effort|High effort/i).first(),
    ).toBeVisible();
  });
});

test.describe('Overview — async cockpit loading skeletons', () => {
  test('AI engines + LCP show calm skeletons while data is in flight', async ({ page }) => {
    await page.goto(`${FIXTURE_URL}?state=loading`);
    await page.waitForSelector('[role="tablist"]');

    // §02 engine chips skeleton (geoAnalysis omitted).
    await expect(page.getByText(/Interrogation des moteurs IA|Querying AI engines/i)).toBeVisible();
    // §03 LCP skeleton (coreWebVitals omitted + cwvLoading=true).
    await expect(page.getByText(/Mesure de la vitesse|Measuring speed/i)).toBeVisible();

    // The robots-IA line is synchronous → still shown immediately.
    await expect(page.getByText(/Robots IA|AI robots/i)).toBeVisible();
  });
});

test.describe('Overview — terminal degraded states (no perpetual skeleton)', () => {
  test('C1 — geo fetch failed: shows "indisponibles", NOT the animated skeleton', async ({ page }) => {
    // ?state=geo-failed = geoLoading false + geoAnalysis absent (fetch returned null).
    await page.goto(`${FIXTURE_URL}?state=geo-failed`);
    await page.waitForSelector('[role="tablist"]');

    // Terminal degraded message in §02.
    await expect(
      page.getByText(/Moteurs IA indisponibles|AI engines unavailable/i),
    ).toBeVisible();

    // The animated "Interrogation des moteurs IA…" skeleton must NOT be present
    // (that would mean it animates forever on a fetch failure).
    await expect(page.getByText(/Interrogation des moteurs IA|Querying AI engines/i)).toHaveCount(0);

    // The "Détail IA →" link is still available (lives in the section header).
    await expect(page.getByRole('button', { name: /Détail IA|AI detail/i })).toBeVisible();

    // The robots-IA line is synchronous → still shown.
    await expect(page.getByText(/Robots IA|AI robots/i)).toBeVisible();
  });

  test('C2 — errored engine renders "indisponible"/neutral, NOT a red ✗', async ({ page }) => {
    // ?state=engine-mix: chatgpt errored, gemini indexed, claude not-indexed, mistral untested.
    await page.goto(`${FIXTURE_URL}?state=engine-mix`);
    await page.waitForSelector('[role="tablist"]');

    // The errored ChatGPT engine shows the "indisponible" / "unavailable" suffix,
    // never the red ✗ that would falsely imply "doesn't cite you".
    const chatgptChip = page.getByText(/ChatGPT\s+(indisponible|unavailable)/i);
    await expect(chatgptChip).toBeVisible();

    // The untested Mistral engine shows "non testé" / "not tested" (neutral).
    await expect(page.getByText(/Mistral\s+(non testé|not tested)/i)).toBeVisible();

    // Honest denominator: only gemini + claude are tested non-error → "1 / 2"
    // (gemini cited, claude not). Errored + untested are excluded from both.
    await expect(page.getByText(/1\s*\/\s*2/).first()).toBeVisible();
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

test.describe('GEO tab — E-E-A-T 3-state badge', () => {
  test('E-E-A-T panel renders a "non vérifié" badge for an unverified signal', async ({ page }) => {
    await page.goto(`${FIXTURE_URL}?tab=geo`);
    await page.waitForSelector('[role="tablist"]');
    const badge = page.getByTitle(/non vérifié|not verified/i);
    await expect(badge.first()).toBeVisible();
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
