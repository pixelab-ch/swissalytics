/**
 * Responsive smoke tests.
 *
 * For each key route, at mobile / tablet / desktop viewports, assert that no
 * visible element overflows the viewport horizontally. body has
 * `overflow-x: hidden` (which only *clips* overflow), so we cannot rely on
 * documentElement.scrollWidth — instead we scan element bounding boxes and
 * flag any whose right edge extends meaningfully past the viewport width.
 *
 * Positioned (fixed/absolute) layers are skipped: they host the sticky bar and
 * decorative animation lines (e.g. the scanner) that intentionally span edges.
 * Elements living inside an ancestor that scrolls/clips horizontally
 * (overflow-x: auto | scroll | hidden) are also skipped: horizontal scroll bars
 * (the collapsed report tab rail, wide comparison tables) and ellipsis-truncated
 * text (overflow:hidden) are intentional and don't break the page layout. Only
 * content clipped solely by the page-level body (overflow-x:hidden) is flagged.
 */
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

// Routes that render without a live analysis. '/e2e/report' is the report
// cockpit fixture (guarded by E2E=1 in playwright.config.ts).
const ROUTES = [
  '/',
  '/methode',
  '/guide-geo',
  '/a-propos',
  '/exemples',
  '/blog',
  '/blog/comment-chatgpt-choisit-ses-sources',
  '/glossaire',
  '/compare',
  '/compare/swissalytics-vs-semrush',
  '/mentions-legales',
  '/confidentialite',
  '/e2e/report',
];

async function findOverflowing(page: import('@playwright/test').Page, vw: number) {
  return page.evaluate((viewportWidth) => {
    const offenders: string[] = [];
    const els = Array.from(document.querySelectorAll<HTMLElement>('body *'));
    for (const el of els) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      // Skip positioned layers (sticky bar, absolute animation lines).
      if (cs.position === 'fixed' || cs.position === 'absolute') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // 2px tolerance for sub-pixel rounding / 1px borders.
      if (r.right > viewportWidth + 2) {
        // Skip if an ancestor (excluding body/html) intentionally scrolls or
        // clips horizontally — that element is contained, not breaking layout.
        let inScrollClip = false;
        let a = el.parentElement;
        while (a && a !== document.body) {
          const ox = getComputedStyle(a).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') {
            inScrollClip = true;
            break;
          }
          a = a.parentElement;
        }
        if (inScrollClip) continue;
        const cls = typeof el.className === 'string' ? el.className.slice(0, 50) : '';
        offenders.push(`<${el.tagName.toLowerCase()} class="${cls}"> right=${Math.round(r.right)}`);
      }
    }
    // De-dup and cap so failure output stays readable.
    return Array.from(new Set(offenders)).slice(0, 25);
  }, vw);
}

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow — ${route} @ ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(route, { waitUntil: 'networkidle' });
      // Let async layout (fonts, sticky, client effects like isNarrow) settle.
      await page.waitForTimeout(400);
      const offenders = await findOverflowing(page, vp.width);
      expect(
        offenders,
        `Elements overflow the ${vp.width}px viewport on ${route}:\n${offenders.join('\n')}`,
      ).toEqual([]);
    });
  }
}
