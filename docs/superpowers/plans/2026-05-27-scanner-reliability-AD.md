# Scanner Reliability A→D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Project uses **pnpm** (NOT npm). Swissalytics dev server runs on **port 3001**.

**Goal:** Reduce scanner false negatives (saying "missing" when a page exists) by adding a per-origin concurrency limiter (A), an honest "non vérifié" 3-state for E-E-A-T signals (B), sitemap-driven page discovery (C), and a transient-failure retry (D).

**Architecture:** All four build on a single new fetch primitive in `page-discovery.ts` — `fetchPageOutcome(url)` returns `{ kind: 'ok' | 'absent' | 'unknown' }`, distinguishing a *definitively absent* page (HTTP 404/410 or soft-404) from an *indeterminate* one (timeout / abort / 5xx / 403 / SSRF). `fetchRealPage` becomes a thin back-compat wrapper (`kind==='ok' ? html : null`) so schema-org and `fetchFirstAvailable` keep identical behaviour. The semaphore (A) and retry (D) live inside `fetchPageOutcome`; the 3-state (B) flows from a new `probeSignal` aggregator up through `EEATResult` → route → `GeoEeat` → UI; sitemap (C) extends `PageContext` + `candidateUrls`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, vitest, Playwright, cheerio. Design tokens: amber via `var(--sa-amber-ink, #b88600)` (text) — same fallback pattern `EngineCard` already uses for the engine-error state.

---

## File Structure

**Modified:**
- `src/lib/analyzers/page-discovery.ts` — new `FetchOutcome` type, `fetchPageOutcome`, `SignalState` type, `ProbeResult` type, `probeSignal`; `fetchRealPage` reduced to wrapper; per-origin `Semaphore` (A); retry (D); `PageContext.sitemapUrls` + sitemap fetch/parse (C); `candidateUrls` matches sitemap locs (C).
- `src/lib/analyzers/eeat.ts` — signal analyzers return `state`; `EEATResult.signals` shape gains `state`; `legalMentions` boolean → object; score + reco use `.found`/`.state`.
- `src/lib/analyzers/composite-score.ts` — suppress "create team page" / "publish testimonials" recos unless `state === 'absent'`.
- `src/lib/analyzers/resilience.ts` — `eeatFallback` returns `state: 'unverified'` for all signals; new `legalMentions` object shape.
- `src/lib/analyzers/types.ts` — `EeatSignals` carries `state` on all four signals; `legalMentions` → object.
- `src/app/api/geo-analyze/route.ts` — map `state` through for all four EEAT signals.
- `src/components/report/GeoTabContent.tsx` — `StatusBadge` 3-state; `buildEeatGroups` threads `state`; `EeatPanel` header counts.
- `src/app/e2e/report/page.tsx` — fixture updated to new shape, with one `unverified` signal.
- `e2e/result-view.spec.ts` — assert the "non vérifié" badge renders.

**Test files (create/modify):**
- `src/lib/analyzers/__tests__/page-discovery.test.ts` — `fetchPageOutcome` classification, `Semaphore` concurrency, retry, sitemap matching, `probeSignal`.
- `src/lib/analyzers/__tests__/eeat.test.ts` — 3-state per signal; update `legalMentions` assertions.
- `src/lib/analyzers/__tests__/composite-score.test.ts` — reco suppression on `unverified` (create if missing).
- `src/lib/analyzers/__tests__/resilience.test.ts` — `eeatFallback` unverified + new shape.

---

## Shared type definitions (introduced in Task 1, referenced everywhere)

```typescript
// in src/lib/analyzers/page-discovery.ts

/** Outcome of a single page fetch, distinguishing definitive-absent from indeterminate. */
export type FetchOutcome =
  | { kind: 'ok'; html: string }
  | { kind: 'absent' }    // HTTP 404/410, or HTTP-200 soft-404 — page confidently not there
  | { kind: 'unknown' };  // timeout/abort/network err/SSRF reject/401/403/429/5xx — couldn't determine

/** Honest 3-state for a discovered signal. */
export type SignalState = 'present' | 'absent' | 'unverified';

/** Aggregate result of probing a signal's candidate URLs. */
export type ProbeResult =
  | { state: 'present'; url: string; html: string }
  | { state: 'absent' }
  | { state: 'unverified' };
```

---

## Task 1: Fetch outcome core (`fetchPageOutcome`) + `fetchRealPage` wrapper

Pure refactor + new capability. No caller behaviour changes yet (wrapper preserves `string | null`).

**Files:**
- Modify: `src/lib/analyzers/page-discovery.ts`
- Test: `src/lib/analyzers/__tests__/page-discovery.test.ts`

- [ ] **Step 1: Write failing tests for `fetchPageOutcome` classification**

Add to `page-discovery.test.ts` (it already stubs `assertSafeUrl` to succeed, and uses `vi.stubGlobal('fetch', …)`; import `fetchPageOutcome` from `../page-discovery`):

```typescript
describe('fetchPageOutcome — classification', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  const PAGE = '<html><head><title>Real</title></head><body>ok</body></html>';
  const SOFT_404 = '<html><head><title>Page introuvable</title></head><body><h1>404</h1></body></html>';

  it('returns ok with html for a 200 real page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(PAGE, { status: 200 })));
    const o = await fetchPageOutcome('https://site.com/x');
    expect(o.kind).toBe('ok');
    if (o.kind === 'ok') expect(o.html).toContain('ok');
  });

  it('returns absent for a 200 soft-404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(SOFT_404, { status: 200 })));
    expect((await fetchPageOutcome('https://site.com/x')).kind).toBe('absent');
  });

  it('returns absent for HTTP 404 and 410', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nf', { status: 404 })));
    expect((await fetchPageOutcome('https://site.com/a')).kind).toBe('absent');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 410 })));
    expect((await fetchPageOutcome('https://site.com/b')).kind).toBe('absent');
  });

  it('returns unknown for 403, 429 and 5xx (blocked / server error, page may exist)', async () => {
    for (const status of [403, 429, 500, 503]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status })));
      expect((await fetchPageOutcome('https://site.com/x')).kind).toBe('unknown');
    }
  });

  it('returns unknown when fetch throws (abort / network error)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('aborted'); }));
    expect((await fetchPageOutcome('https://site.com/x')).kind).toBe('unknown');
  });
});

describe('fetchRealPage — wrapper preserves string|null', () => {
  afterEach(() => vi.restoreAllMocks());
  it('returns html on ok, null on absent and unknown', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<title>x</title><body>hi</body>', { status: 200 })));
    expect(await fetchRealPage('https://site.com/x')).toContain('hi');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nf', { status: 404 })));
    expect(await fetchRealPage('https://site.com/x')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    expect(await fetchRealPage('https://site.com/x')).toBeNull();
  });
});
```

Add `fetchPageOutcome` to the existing import line from `../page-discovery`.

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/analyzers/__tests__/page-discovery.test.ts`
Expected: FAIL — `fetchPageOutcome is not a function`.

- [ ] **Step 3: Implement `fetchPageOutcome` and reduce `fetchRealPage` to a wrapper**

Add the `FetchOutcome` type (from "Shared type definitions" above) near the top of `page-discovery.ts`. Replace the existing `fetchRealPage` body (currently lines ~199-230) with:

```typescript
/**
 * Fetch a page once and CLASSIFY the result into a 3-way outcome:
 *   - 'ok'      → 2xx with real content (not a soft-404).
 *   - 'absent'  → HTTP 404/410, or HTTP-200 soft-404. The page is confidently
 *                 not there.
 *   - 'unknown' → timeout / abort / network error / SSRF reject / 401 / 403 /
 *                 429 / 5xx / other non-ok. We could NOT determine existence;
 *                 the page may well exist (slow, blocked, gated).
 *
 * This distinction is what lets the E-E-A-T layer say "non vérifié" instead of
 * "manquant" when a real page is merely unreachable (see probeSignal / Task 5).
 *
 * Every fetch passes through `assertSafeUrl` first (the URL may derive from an
 * untrusted page's links). A guard rejection is 'unknown' (we refused to fetch,
 * so we genuinely don't know) — never a false 'absent'. A per-fetch
 * AbortController caps the socket lifetime (FETCH_TIMEOUT_MS).
 */
export async function fetchPageOutcome(url: string): Promise<FetchOutcome> {
  try {
    await assertSafeUrl(url);
  } catch (err) {
    if (err instanceof SsrfError) {
      console.log(`[page-discovery] URL rejetée (SSRF): ${url} (${err.code})`);
    }
    return { kind: 'unknown' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    });
    if (response.ok) {
      const html = await response.text();
      const title = cheerio.load(html)('title').text();
      if (looksLikeSoftError(html, title)) {
        console.log(`[page-discovery] Soft-404 rejeté: ${url}`);
        return { kind: 'absent' };
      }
      return { kind: 'ok', html };
    }
    // Definitively-gone statuses are 'absent'; everything else (auth/blocked/
    // rate-limited/server error) is 'unknown' — the page may exist.
    if (response.status === 404 || response.status === 410) return { kind: 'absent' };
    return { kind: 'unknown' };
  } catch {
    // Abort (timeout) or network error — indeterminate.
    return { kind: 'unknown' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Back-compat wrapper: the original `string | null` contract used by schema-org
 * (single + multipage) and `fetchFirstAvailable`. Both 'absent' and 'unknown'
 * collapse to null, exactly as the pre-outcome `fetchRealPage` did, so those
 * callers are unchanged.
 */
export async function fetchRealPage(url: string): Promise<string | null> {
  const outcome = await fetchPageOutcome(url);
  return outcome.kind === 'ok' ? outcome.html : null;
}
```

(`UA`, `FETCH_TIMEOUT_MS`, `assertSafeUrl`, `SsrfError`, `looksLikeSoftError`, `cheerio` are all already imported/defined in this file.)

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test src/lib/analyzers/__tests__/page-discovery.test.ts`
Expected: PASS (new classification tests + all existing `fetchFirstAvailable` tests still green — they exercise the wrapper).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` then:
```bash
git add src/lib/analyzers/page-discovery.ts src/lib/analyzers/__tests__/page-discovery.test.ts
git commit -m "feat(scanner): fetchPageOutcome 3-way fetch classification (ok/absent/unknown)"
```

---

## Task 2 (Option A): Per-origin concurrency limiter

Bound the same-origin fetch burst (~20-30 simultaneous → 6) so we stop self-inflicting timeouts on small sites.

**Files:**
- Modify: `src/lib/analyzers/page-discovery.ts`
- Test: `src/lib/analyzers/__tests__/page-discovery.test.ts`

- [ ] **Step 1: Write failing test for per-origin concurrency cap**

```typescript
describe('fetchPageOutcome — per-origin concurrency limiter (Option A)', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('caps concurrent fetches to the SAME origin at MAX_PER_ORIGIN', async () => {
    let inFlight = 0;
    let maxConcurrent = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      inFlight++; maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return new Response('<title>x</title><body>ok</body>', { status: 200 });
    }));

    const urls = Array.from({ length: 20 }, (_, i) => `https://same.com/p${i}`);
    await Promise.all(urls.map((u) => fetchPageOutcome(u)));

    expect(maxConcurrent).toBeLessThanOrEqual(MAX_PER_ORIGIN);
    expect(maxConcurrent).toBeGreaterThan(1); // not serialized
  });

  it('does NOT throttle across DIFFERENT origins', async () => {
    let inFlight = 0;
    let maxConcurrent = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      inFlight++; maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return new Response('<title>x</title><body>ok</body>', { status: 200 });
    }));

    // 8 distinct origins → all should run at once (limiter is per-origin).
    const urls = Array.from({ length: 8 }, (_, i) => `https://host${i}.com/p`);
    await Promise.all(urls.map((u) => fetchPageOutcome(u)));
    expect(maxConcurrent).toBe(8);
  });
});
```

Add `MAX_PER_ORIGIN` to the import line from `../page-discovery`.

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/analyzers/__tests__/page-discovery.test.ts`
Expected: FAIL — `MAX_PER_ORIGIN is not defined` (and the same-origin test would fail on max=20 once the import resolves).

- [ ] **Step 3: Implement a minimal FIFO semaphore, keyed by origin**

Add near the top of `page-discovery.ts` (after `FETCH_TIMEOUT_MS`):

```typescript
/**
 * Max simultaneous fetches to a SINGLE origin. The analyzers fire a burst of
 * same-origin sub-page fetches (homepage + ≤3×team/contact/legal/testimonials
 * + schema groups + sitemap). Unbounded, that's ~20-30 parallel connections to
 * one small CMS — which intermittently self-inflicts the timeouts we just
 * fixed, and can trip a WAF into blocking our server IP. 6 keeps us polite
 * while staying well within the analyzer time budgets (most fetches return
 * fast; a slow site fails open via the analyzer-level withTimeout).
 */
export const MAX_PER_ORIGIN = 6;

/** Minimal FIFO counting semaphore. */
class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly max: number) {}
  async acquire(): Promise<void> {
    if (this.active < this.max) { this.active++; return; }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }
  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

/** One semaphore per origin (lazily created). Process-lifetime map. */
const originSemaphores = new Map<string, Semaphore>();
function originSemaphore(url: string): Semaphore {
  let origin: string;
  try { origin = new URL(url).origin; } catch { origin = url; }
  let sem = originSemaphores.get(origin);
  if (!sem) { sem = new Semaphore(MAX_PER_ORIGIN); originSemaphores.set(origin, sem); }
  return sem;
}
```

Then wrap ONLY the network portion of `fetchPageOutcome` with the semaphore — acquire after `assertSafeUrl` passes (don't hold a slot during DNS-guard), release in `finally`:

```typescript
export async function fetchPageOutcome(url: string): Promise<FetchOutcome> {
  try {
    await assertSafeUrl(url);
  } catch (err) {
    if (err instanceof SsrfError) {
      console.log(`[page-discovery] URL rejetée (SSRF): ${url} (${err.code})`);
    }
    return { kind: 'unknown' };
  }

  const sem = originSemaphore(url);
  await sem.acquire();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // ... unchanged fetch + classification body from Task 1 ...
  } catch {
    return { kind: 'unknown' };
  } finally {
    clearTimeout(timer);
    sem.release();
  }
}
```

> Implementer note: keep the fetch/classification body byte-for-byte from Task 1; only the `sem.acquire()` before the try and `sem.release()` in `finally` are added.

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/analyzers/__tests__/page-discovery.test.ts`
Expected: PASS. (The `fetchFirstAvailable` "dispatches ALL 3 candidates concurrently" test still passes: 3 ≤ 6.)

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/lib/analyzers/page-discovery.ts src/lib/analyzers/__tests__/page-discovery.test.ts
git commit -m "feat(scanner): per-origin concurrency limiter (cap 6) to bound fetch burst (Option A)"
```

---

## Task 3 (Option D): Retry once on transient failure

A cold-start or transient blip currently looks like a permanent failure. Retry an `unknown` outcome ONCE (never an `absent` — a 404 is final).

**Files:**
- Modify: `src/lib/analyzers/page-discovery.ts`
- Test: `src/lib/analyzers/__tests__/page-discovery.test.ts`

- [ ] **Step 1: Write failing tests for retry semantics**

```typescript
describe('fetchPageOutcome — retry once on transient (Option D)', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('retries ONCE when the first attempt is unknown, succeeding on retry', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('transient network blip');
      return new Response('<title>x</title><body>ok</body>', { status: 200 });
    }));
    const o = await fetchPageOutcome('https://site.com/x');
    expect(o.kind).toBe('ok');
    expect(calls).toBe(2);
  });

  it('does NOT retry an absent (404) outcome', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => { calls++; return new Response('nf', { status: 404 }); }));
    expect((await fetchPageOutcome('https://site.com/x')).kind).toBe('absent');
    expect(calls).toBe(1);
  });

  it('gives up after exactly one retry (2 attempts) and returns unknown', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => { calls++; throw new Error('still down'); }));
    expect((await fetchPageOutcome('https://site.com/x')).kind).toBe('unknown');
    expect(calls).toBe(2);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/analyzers/__tests__/page-discovery.test.ts`
Expected: FAIL — current code fetches once (`calls` will be 1, not 2).

- [ ] **Step 3: Implement retry by splitting one-attempt logic out**

Rename the current network body to a private `attemptFetch(url)` returning `FetchOutcome`, and have `fetchPageOutcome` call it up to twice. The SSRF guard + semaphore stay in `fetchPageOutcome` (guard once; each attempt takes/releases a slot):

```typescript
const MAX_FETCH_ATTEMPTS = 2; // 1 try + 1 retry on transient 'unknown'

/** One guarded, semaphore-bounded network attempt. */
async function attemptFetch(url: string): Promise<FetchOutcome> {
  const sem = originSemaphore(url);
  await sem.acquire();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
    if (response.ok) {
      const html = await response.text();
      const title = cheerio.load(html)('title').text();
      if (looksLikeSoftError(html, title)) {
        console.log(`[page-discovery] Soft-404 rejeté: ${url}`);
        return { kind: 'absent' };
      }
      return { kind: 'ok', html };
    }
    if (response.status === 404 || response.status === 410) return { kind: 'absent' };
    return { kind: 'unknown' };
  } catch {
    return { kind: 'unknown' };
  } finally {
    clearTimeout(timer);
    sem.release();
  }
}

export async function fetchPageOutcome(url: string): Promise<FetchOutcome> {
  try {
    await assertSafeUrl(url);
  } catch (err) {
    if (err instanceof SsrfError) console.log(`[page-discovery] URL rejetée (SSRF): ${url} (${err.code})`);
    return { kind: 'unknown' };
  }
  // Retry ONLY a transient 'unknown' (cold-start, blip, 5xx). 'absent' (404/
  // soft-404) is final — never retried. Bounded at 1 retry so a dead host adds
  // at most one extra timeout, staying inside the analyzer budget.
  let outcome: FetchOutcome = { kind: 'unknown' };
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    outcome = await attemptFetch(url);
    if (outcome.kind !== 'unknown') return outcome;
  }
  return outcome;
}
```

- [ ] **Step 4: Run full analyzers suite, verify pass**

Run: `pnpm test src/lib/analyzers/`
Expected: PASS (retry tests green; existing tests unaffected — they never return `unknown` twice).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/lib/analyzers/page-discovery.ts src/lib/analyzers/__tests__/page-discovery.test.ts
git commit -m "feat(scanner): retry once on transient fetch failure, never on 404 (Option D)"
```

---

## Task 4 (Option C): Sitemap-driven candidate discovery

Catch real pages that exist but aren't linked from the homepage, using the `sitemap.xml` we can fetch alongside the homepage.

**Files:**
- Modify: `src/lib/analyzers/page-discovery.ts`
- Test: `src/lib/analyzers/__tests__/page-discovery.test.ts`

- [ ] **Step 1: Write failing tests for sitemap parse + candidate matching**

```typescript
import { parseSitemapLocs, candidateUrls } from '../page-discovery';

describe('parseSitemapLocs', () => {
  it('extracts <loc> URLs from a urlset', () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://site.com/fr/lequipe/</loc></url>` +
      `<url><loc>https://site.com/contact</loc></url></urlset>`;
    expect(parseSitemapLocs(xml)).toEqual(['https://site.com/fr/lequipe/', 'https://site.com/contact']);
  });
  it('caps at SITEMAP_MAX_LOCS and ignores junk', () => {
    const many = Array.from({ length: 2000 }, (_, i) => `<url><loc>https://site.com/p${i}</loc></url>`).join('');
    const out = parseSitemapLocs(`<urlset>${many}</urlset>`);
    expect(out.length).toBe(SITEMAP_MAX_LOCS);
  });
  it('returns [] for empty / unparseable input', () => {
    expect(parseSitemapLocs('')).toEqual([]);
    expect(parseSitemapLocs('not xml')).toEqual([]);
  });
});

describe('candidateUrls — sitemap as a second source (Option C)', () => {
  const linkList = (hrefs: string[]): PageLink[] => hrefs.map((href) => ({ href, text: '' }));
  it('matches a keyworded sitemap URL when no homepage link matched', () => {
    const out = candidateUrls(
      'https://site.com/', 'https://site.com',
      linkList(['/products']),                       // no team link on homepage
      TEAM_KEYWORDS, [],
      ['https://site.com/fr/lequipe/', 'https://site.com/blog/x'], // sitemap locs
    );
    expect(out).toContain('https://site.com/fr/lequipe/');
  });
  it('keeps homepage links FIRST, sitemap matches appended, deduped, capped at 3', () => {
    const out = candidateUrls(
      'https://site.com/', 'https://site.com',
      linkList(['/equipe']),
      TEAM_KEYWORDS, [],
      ['https://site.com/equipe', 'https://site.com/about-us', 'https://site.com/team', 'https://site.com/ueber-uns'],
    );
    expect(out[0]).toBe('https://site.com/equipe'); // homepage link wins order
    expect(out.length).toBe(3);                     // MAX_CANDIDATES
    expect(new Set(out).size).toBe(out.length);     // deduped
  });
  it('drops cross-origin sitemap locs (same-origin guard still applies)', () => {
    const out = candidateUrls(
      'https://site.com/', 'https://site.com',
      [], TEAM_KEYWORDS, [],
      ['https://evil.com/equipe', 'https://site.com/equipe'],
    );
    expect(out).toEqual(['https://site.com/equipe']);
  });
});
```

Add `parseSitemapLocs` and `SITEMAP_MAX_LOCS` to the import line.

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/analyzers/__tests__/page-discovery.test.ts`
Expected: FAIL — `parseSitemapLocs is not a function`; `candidateUrls` arity mismatch.

- [ ] **Step 3: Implement `parseSitemapLocs`, extend `candidateUrls`, fetch sitemap in `buildPageContext`**

Add:

```typescript
/** Max <loc> entries we parse from a sitemap (bounds parse cost on huge sites). */
export const SITEMAP_MAX_LOCS = 1000;

/**
 * Extract <loc> URLs from a sitemap.xml body (regex, no XML dep — robust to
 * the malformed sitemaps real CMSes emit). Sitemap-index files yield child
 * .xml locs which simply won't match page keywords downstream — we do NOT
 * recurse into them (out of scope; bounded cost).
 */
export function parseSitemapLocs(xml: string): string[] {
  if (!xml) return [];
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1].trim());
    if (out.length >= SITEMAP_MAX_LOCS) break;
  }
  return out;
}
```

Extend `candidateUrls` to accept an optional `sitemapLocs` source. Homepage links keep priority (document order = best); sitemap matches are appended, then the existing same-site filter + dedupe + `MAX_CANDIDATES` cap apply uniformly. Change the signature and add a second matching loop:

```typescript
export function candidateUrls(
  pageUrl: string,
  baseUrl: string,
  linksList: PageLink[],
  keywords: string[],
  fallbackSlugs: string[],
  sitemapLocs: string[] = [],   // Option C — second discovery source
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string | undefined) => {
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };
  const pageHost = (() => { try { return new URL(pageUrl).hostname; } catch { return ''; } })();

  // 1. Homepage links (existing logic, unchanged) — highest priority, doc order.
  for (const link of linksList) {
    if (!matchesKeyword(link, keywords)) continue;
    if (/^(tel:|mailto:|javascript:|#)/i.test(link.href)) continue;
    try {
      const abs = new URL(link.href, pageUrl);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
      if (pageHost && !isSameSite(abs, pageHost)) continue;
      push(abs.href);
    } catch { /* ignore */ }
  }

  // 2. Sitemap URLs (Option C) — appended after homepage links. A sitemap loc
  //    is matched the same way (path segment / keyword) via a synthetic
  //    PageLink with empty anchor text. Same-origin + scheme guards reused.
  for (const loc of sitemapLocs) {
    if (!matchesKeyword({ href: loc, text: '' }, keywords)) continue;
    try {
      const abs = new URL(loc, pageUrl);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
      if (pageHost && !isSameSite(abs, pageHost)) continue;
      push(abs.href);
    } catch { /* ignore */ }
  }

  // 3. Safety-net probe slugs only when NEITHER source matched.
  if (out.length === 0) {
    for (const slug of fallbackSlugs) push(`${baseUrl}/${slug}`);
  }

  return out.slice(0, MAX_CANDIDATES);
}
```

Extend `PageContext` with `sitemapUrls` and fetch the sitemap in `buildPageContext` (in parallel with reuse of the already-fetched homepage — one extra same-origin fetch, bounded by Task 2's limiter):

```typescript
export interface PageContext {
  url: string;
  html: string;
  $: cheerio.CheerioAPI;
  links: PageLink[];
  /** <loc> URLs parsed from the site's sitemap.xml (Option C); [] if none. */
  sitemapUrls: string[];
}

export async function buildPageContext(url: string): Promise<PageContext | null> {
  const html = await fetchRealPage(url);
  if (html === null) return null;
  const $ = cheerio.load(html);
  // Best-effort sitemap fetch — never blocks/cancels the context. A missing
  // sitemap just yields []. Same-origin, so the per-origin limiter applies.
  let sitemapUrls: string[] = [];
  try {
    const origin = new URL(url).origin;
    const outcome = await fetchPageOutcome(`${origin}/sitemap.xml`);
    if (outcome.kind === 'ok') sitemapUrls = parseSitemapLocs(outcome.html);
  } catch { /* no sitemap → [] */ }
  return { url, html, $, links: extractLinks($), sitemapUrls };
}
```

> Note: `looksLikeSoftError` won't false-positive on XML (no `<title>`/`<h1>` "not found" text in a real sitemap). A site serving an HTML 404 page at `/sitemap.xml` yields `absent` → `sitemapUrls = []`. Fine.

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/analyzers/__tests__/page-discovery.test.ts`
Expected: PASS. Existing `candidateUrls` tests still pass (new param defaults to `[]`).

- [ ] **Step 5: Thread `sitemapUrls` into EEAT + schema candidate discovery**

In `eeat.ts`, the three `candidateUrls(...)` calls (team/contact/legal) and the testimonials call currently take 5 args from `pageLinks`. They need `ctx.sitemapUrls`. Since `analyzeEEAT` already receives `ctx`, pass `ctx?.sitemapUrls ?? []` down through the signal helpers (add a `sitemapUrls: string[]` param to `analyzeTeamPage`, `checkLegalMentions`, `analyzeContactPage`, `analyzeTestimonials`, threaded from `analyzeEEAT`). Example for team:

```typescript
// in analyzeEEAT, after `const pageLinks = ctx?.links ?? [];`
const sitemapUrls = ctx?.sitemapUrls ?? [];
// pass sitemapUrls as a new last arg to each probe call below.

// in analyzeTeamPage(pageUrl, baseUrl, pageLinks, sitemapUrls):
const urls = candidateUrls(pageUrl, baseUrl, pageLinks, TEAM_KEYWORDS,
  ['team', 'about', 'a-propos', 'qui-sommes-nous', 'equipe'], sitemapUrls);
```

In `schema-org.ts`, `discoverSchemaCandidateGroups(pageUrl, baseUrl, links)` → add `sitemapUrls` param and pass it into its `candidateUrls(...)` call; `analyzeSchemaOrgMultiPage` passes `ctx.sitemapUrls`.

> These call-site edits are covered by the existing `eeat.test.ts` / `schema-org.test.ts` suites (which build a PageContext) plus typecheck — run them in Step 6.

- [ ] **Step 6: Run analyzers suite + typecheck + commit**

Run: `pnpm test src/lib/analyzers/ && pnpm exec tsc --noEmit`
Expected: PASS. (If `eeat.test.ts` / `schema-org.test.ts` construct a `PageContext` literal, add `sitemapUrls: []` to those fixtures.)
```bash
git add src/lib/analyzers/page-discovery.ts src/lib/analyzers/eeat.ts src/lib/analyzers/schema-org.ts src/lib/analyzers/__tests__/
git commit -m "feat(scanner): sitemap.xml as a second page-discovery source (Option C)"
```

---

## Task 5 (Option B, part 1): `probeSignal` + E-E-A-T 3-state signals

**Files:**
- Modify: `src/lib/analyzers/page-discovery.ts` (add `probeSignal`)
- Modify: `src/lib/analyzers/eeat.ts`
- Test: `src/lib/analyzers/__tests__/page-discovery.test.ts`, `src/lib/analyzers/__tests__/eeat.test.ts`

- [ ] **Step 1: Write failing tests for `probeSignal`**

```typescript
import { probeSignal } from '../page-discovery';

describe('probeSignal — found / absent / unverified (Option B)', () => {
  afterEach(() => vi.restoreAllMocks());
  const PAGE = '<html><head><title>x</title></head><body>ok</body></html>';

  it('absent when there are no candidate URLs (nothing references such a page)', async () => {
    const stub = vi.fn();
    vi.stubGlobal('fetch', stub);
    expect(await probeSignal([])).toEqual({ state: 'absent' });
    expect(stub).not.toHaveBeenCalled();
  });

  it('present (with url+html) when a candidate fetches ok — first in order', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(PAGE, { status: 200 })));
    const r = await probeSignal(['https://site.com/a', 'https://site.com/b']);
    expect(r.state).toBe('present');
    if (r.state === 'present') expect(r.url).toBe('https://site.com/a');
  });

  it('absent when every candidate is a definitive 404 / soft-404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nf', { status: 404 })));
    expect(await probeSignal(['https://site.com/a'])).toEqual({ state: 'absent' });
  });

  it('unverified when candidates exist but all are indeterminate (timeout/5xx)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 503 })));
    expect(await probeSignal(['https://site.com/a', 'https://site.com/b'])).toEqual({ state: 'unverified' });
  });

  it('unverified when mixing absent + unknown with no ok (can not conclude absent)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/a')
        ? new Response('nf', { status: 404 })     // absent
        : new Response('x', { status: 500 })));   // unknown
    expect(await probeSignal(['https://site.com/a', 'https://site.com/b'])).toEqual({ state: 'unverified' });
  });
});
```

- [ ] **Step 2: Run, verify fail.** `pnpm test src/lib/analyzers/__tests__/page-discovery.test.ts` → `probeSignal is not a function`.

- [ ] **Step 3: Implement `probeSignal`**

Add the `SignalState` and `ProbeResult` types (from "Shared type definitions") and:

```typescript
/**
 * Probe a signal's candidate URLs and return an HONEST 3-state:
 *   - 'present'    → at least one candidate fetched ok (returns the first by
 *                    order, with its html for downstream parsing).
 *   - 'absent'     → no candidates at all, OR every candidate was definitively
 *                    absent (404 / soft-404). We're confident the page isn't there.
 *   - 'unverified' → candidates existed but at least one was indeterminate
 *                    (timeout / blocked / 5xx) and none fetched ok. We can NOT
 *                    claim absence — the page may well exist. This is the state
 *                    that prevents a false "manquant" → bogus "create page X" reco.
 *
 * Fetches all candidates concurrently (worst-case wall ≈ one timeout, bounded
 * by the per-origin limiter) and preserves first-by-order for the 'present' hit.
 */
export async function probeSignal(urls: string[]): Promise<ProbeResult> {
  if (urls.length === 0) return { state: 'absent' };
  const outcomes = await Promise.all(urls.map((u) => fetchPageOutcome(u)));
  for (let i = 0; i < outcomes.length; i++) {
    const o = outcomes[i];
    if (o.kind === 'ok') return { state: 'present', url: urls[i], html: o.html };
  }
  if (outcomes.some((o) => o.kind === 'unknown')) return { state: 'unverified' };
  return { state: 'absent' };
}
```

Re-export `SignalState` and `ProbeResult` from `eeat.ts`'s existing re-export block (alongside `PageLink`, `PageContext`, etc.) so importers keep one home.

- [ ] **Step 4: Write failing tests for E-E-A-T signal `state`**

In `eeat.test.ts` (it stubs `assertSafeUrl` + `fetch` like page-discovery.test). Add:

```typescript
describe('analyzeEEAT — signal 3-state (Option B)', () => {
  // Helper: build a PageContext with given homepage links + sitemap.
  // (Match the existing eeat.test PageContext construction; add sitemapUrls: [].)

  it('teamPage.state = unverified (not absent) when the team link times out', async () => {
    // homepage links include /fr/lequipe/ ; fetch of it → 503 (unknown)
    // expect result.signals.teamPage.state === 'unverified' and .found === false
  });

  it('teamPage.state = absent when no team link AND no sitemap match', async () => {
    // expect state 'absent', found false
  });

  it('teamPage.state = present when the team page fetches ok', async () => {
    // expect state 'present', found true
  });

  it('legalMentions is now an object { found, state }', async () => {
    // expect typeof result.signals.legalMentions === 'object'
  });
});
```

> Implementer: flesh these out using the existing `eeat.test.ts` fetch-stub helpers (route fetch by URL suffix to return 200 real / 503 / 404 as needed). Keep them deterministic.

Also UPDATE the existing assertion at `eeat.test.ts:178` (`expect(result.signals.legalMentions).toBe(true)`) → `expect(result.signals.legalMentions).toEqual({ found: true, state: 'present' })` (adjust to the scenario).

- [ ] **Step 5: Run, verify fail.** `pnpm test src/lib/analyzers/__tests__/eeat.test.ts`.

- [ ] **Step 6: Update `EEATResult.signals` shape + analyzers to carry `state`**

In `eeat.ts`:

```typescript
import { type SignalState, probeSignal /* + existing imports */ } from './page-discovery';

export interface EEATResult {
  score: number;
  signals: {
    teamPage: { found: boolean; state: SignalState; quality: 'high'|'medium'|'low'|'none'; authorsCount: number };
    legalMentions: { found: boolean; state: SignalState };
    contactPage: { found: boolean; state: SignalState; hasEmail: boolean; hasPhone: boolean; hasAddress: boolean };
    testimonials: { found: boolean; state: SignalState; count: number; hasSchema: boolean };
    backlinks: { total: number; quality: 'high'|'medium'|'low'|'none'; domains: number };
    authorBios: { found: boolean; count: number };
  };
  recommendations: string[];
}
```

Rewrite the four discovery analyzers to use `probeSignal` and return `state`:

```typescript
async function analyzeTeamPage(pageUrl, baseUrl, pageLinks, sitemapUrls) {
  try {
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, TEAM_KEYWORDS,
      ['team','about','a-propos','qui-sommes-nous','equipe'], sitemapUrls);
    const probe = await probeSignal(urls);
    if (probe.state === 'present') {
      const $ = cheerio.load(probe.html);
      /* ...existing author/quality detection on $... */
      return { found: true, state: 'present', quality, authorsCount: authorElements };
    }
    return { found: false, state: probe.state, quality: 'none', authorsCount: 0 };
  } catch {
    return { found: false, state: 'unverified', quality: 'none', authorsCount: 0 };
  }
}

async function checkLegalMentions(pageUrl, baseUrl, pageLinks, sitemapUrls): Promise<{ found: boolean; state: SignalState }> {
  try {
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, LEGAL_KEYWORDS,
      ['mentions-legales','legal','legal-notice','imprint','impressum'], sitemapUrls);
    const probe = await probeSignal(urls);
    return { found: probe.state === 'present', state: probe.state };
  } catch { return { found: false, state: 'unverified' }; }
}

async function analyzeContactPage(pageUrl, baseUrl, pageLinks, sitemapUrls) {
  try {
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, CONTACT_KEYWORDS,
      ['contact','contactez-nous','kontakt','contatti'], sitemapUrls);
    const probe = await probeSignal(urls);
    if (probe.state === 'present') {
      const $ = cheerio.load(probe.html);
      /* ...existing hasEmail/hasPhone/hasAddress... */
      return { found: true, state: 'present', hasEmail, hasPhone, hasAddress };
    }
    return { found: false, state: probe.state, hasEmail: false, hasPhone: false, hasAddress: false };
  } catch { return { found: false, state: 'unverified', hasEmail: false, hasPhone: false, hasAddress: false }; }
}
```

For `analyzeTestimonials` (special: a page that fetches ok but has 0 reviews is verified-absent, not present). Use `fetchPageOutcome` directly per candidate:

```typescript
async function analyzeTestimonials(pageUrl, baseUrl, pageLinks, homepageHtml, sitemapUrls) {
  try {
    if (homepageHtml) {
      const onHome = detectTestimonials(cheerio.load(homepageHtml));
      if (onHome.count > 0) return { found: true, state: 'present', count: onHome.count, hasSchema: onHome.hasSchema };
    }
    const urls = candidateUrls(pageUrl, baseUrl, pageLinks, TESTIMONIAL_KEYWORDS,
      ['testimonials','temoignages','avis','clients','referenzen','recensioni'], sitemapUrls);
    if (urls.length === 0) return { found: false, state: 'absent', count: 0, hasSchema: false };
    const outcomes = await Promise.all(urls.map((u) => fetchPageOutcome(u)));
    let sawUnknown = false;
    for (let i = 0; i < outcomes.length; i++) {
      const o = outcomes[i];
      if (o.kind === 'ok') {
        const { count, hasSchema } = detectTestimonials(cheerio.load(o.html));
        if (count > 0) return { found: true, state: 'present', count, hasSchema };
        // fetched ok but no reviews → this candidate is verified review-less
      } else if (o.kind === 'unknown') {
        sawUnknown = true;
      }
    }
    // No reviews found anywhere. If something was indeterminate, we can't be
    // sure → unverified; otherwise confidently absent.
    return { found: false, state: sawUnknown ? 'unverified' : 'absent', count: 0, hasSchema: false };
  } catch { return { found: false, state: 'unverified', count: 0, hasSchema: false }; }
}
```

Update `calculateEEATScore`: `if (signals.legalMentions)` → `if (signals.legalMentions.found)`. (`found` is already false for unverified, so unverified earns 0 points — conservative & honest; do NOT inflate score on a page we couldn't read.)

Update `generateEEATRecommendations`: gate the "create" recos on confident absence:
- `if (!signals.teamPage.found || signals.teamPage.quality === 'low')` → `if (signals.teamPage.state === 'absent' || (signals.teamPage.found && signals.teamPage.quality === 'low'))`
- `if (!signals.testimonials.found)` → `if (signals.testimonials.state === 'absent')`
- `if (!signals.legalMentions)` → `if (signals.legalMentions.state === 'absent')`
- contact reco: `if (!signals.contactPage.found || ...)` → keep the email/phone sub-check but only fire the "improve contact" reco when `signals.contactPage.state !== 'unverified'`.

Update `simulateEEATData()` fallback to the new shape (`legalMentions: { found: true, state: 'present' }`, add `state` to the other three; teamPage `state:'absent'`, testimonials `state:'absent'`, contactPage `state:'present'`).

- [ ] **Step 7: Run, verify pass.** `pnpm test src/lib/analyzers/__tests__/eeat.test.ts src/lib/analyzers/__tests__/page-discovery.test.ts`

- [ ] **Step 8: Commit**
```bash
git add src/lib/analyzers/page-discovery.ts src/lib/analyzers/eeat.ts src/lib/analyzers/__tests__/
git commit -m "feat(scanner): honest 3-state (present/absent/unverified) for E-E-A-T signals (Option B core)"
```

---

## Task 6 (Option B, part 2): Types + route mapping + resilience fallback

**Files:**
- Modify: `src/lib/analyzers/types.ts`, `src/app/api/geo-analyze/route.ts`, `src/lib/analyzers/resilience.ts`
- Test: `src/lib/analyzers/__tests__/resilience.test.ts`

- [ ] **Step 1: Failing test — `eeatFallback` returns unverified + new shape**

In `resilience.test.ts`, update `:130` and add:
```typescript
it('eeatFallback marks all signals unverified (analyzer failure ≠ confident absence)', () => {
  const fb = eeatFallback();
  expect(fb.signals.teamPage.state).toBe('unverified');
  expect(fb.signals.legalMentions).toEqual({ found: false, state: 'unverified' });
  expect(fb.signals.contactPage.state).toBe('unverified');
  expect(fb.signals.testimonials.state).toBe('unverified');
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Update `types.ts` `EeatSignals`**

```typescript
import type { SignalState } from './page-discovery'; // or re-declare 'present'|'absent'|'unverified'

export interface EeatSignals {
  teamPage: { found: boolean; state: SignalState };
  legalMentions: { found: boolean; state: SignalState };
  contactPage: { found: boolean; state: SignalState };
  testimonials: { found: boolean; count: number; state: SignalState };
}
```

- [ ] **Step 4: Update route mapping** (`route.ts` ~199-207):
```typescript
eeat: {
  score: eeat.score,
  signals: {
    teamPage:      { found: eeat.signals.teamPage.found,      state: eeat.signals.teamPage.state },
    legalMentions: { found: eeat.signals.legalMentions.found, state: eeat.signals.legalMentions.state },
    contactPage:   { found: eeat.signals.contactPage.found,   state: eeat.signals.contactPage.state },
    testimonials:  { found: eeat.signals.testimonials.found,  count: eeat.signals.testimonials.count, state: eeat.signals.testimonials.state },
  },
},
```

- [ ] **Step 5: Update `eeatFallback`** (`resilience.ts`):
```typescript
export function eeatFallback(): EEATResult {
  return {
    score: 0,
    signals: {
      teamPage:    { found: false, state: 'unverified', quality: 'none', authorsCount: 0 },
      legalMentions: { found: false, state: 'unverified' },
      contactPage: { found: false, state: 'unverified', hasEmail: false, hasPhone: false, hasAddress: false },
      testimonials: { found: false, state: 'unverified', count: 0, hasSchema: false },
      backlinks:   { total: 0, quality: 'none', domains: 0 },
      authorBios:  { found: false, count: 0 },
    },
    recommendations: [],
  };
}
```

- [ ] **Step 6: Run tests + typecheck.** `pnpm test src/lib/analyzers/ && pnpm exec tsc --noEmit`
Expected: PASS. tsc will flag any remaining old-shape reads — fix them (the UI is Task 7).

- [ ] **Step 7: Commit**
```bash
git add src/lib/analyzers/types.ts src/app/api/geo-analyze/route.ts src/lib/analyzers/resilience.ts src/lib/analyzers/__tests__/resilience.test.ts
git commit -m "feat(scanner): thread E-E-A-T signal state through types/route/fallback (Option B)"
```

---

## Task 7 (Option B, part 3): Composite-score reco suppression

**Files:**
- Modify: `src/lib/analyzers/composite-score.ts`
- Test: `src/lib/analyzers/__tests__/composite-score.test.ts` (create if absent)

- [ ] **Step 1: Failing tests for suppression**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateCompositeScore } from '../composite-score';
// build a minimal `data` with helpers/fallbacks (reuse resilience fallbacks for
// lighthouse/seo/geo/schema; vary only eeat.signals).

describe('composite recommendations — unverified suppression (Option B)', () => {
  it('recommends "Créer page équipe" when teamPage.state === absent', () => {
    const recs = calculateCompositeScore(dataWithTeam('absent')).topRecommendations;
    expect(recs.some((r) => /page équipe/i.test(r.title))).toBe(true);
  });
  it('does NOT recommend creating a team page when teamPage.state === unverified', () => {
    const recs = calculateCompositeScore(dataWithTeam('unverified')).topRecommendations;
    expect(recs.some((r) => /page équipe/i.test(r.title))).toBe(false);
  });
  it('does NOT recommend publishing testimonials when state === unverified', () => {
    const recs = calculateCompositeScore(dataWithTestimonials('unverified')).topRecommendations;
    expect(recs.some((r) => /témoignages/i.test(r.title))).toBe(false);
  });
});
```

> Implementer: write `dataWithTeam(state)` / `dataWithTestimonials(state)` builders using the resilience fallbacks for the other four analyzers, overriding only the relevant eeat signal.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement suppression** in `generateTopRecommendations`:
- `if (!data.eeat.signals.teamPage.found)` (line ~265) → `if (data.eeat.signals.teamPage.state === 'absent')`
- `if (!data.eeat.signals.testimonials.found)` (line ~278) → `if (data.eeat.signals.testimonials.state === 'absent')`

(Only nag to create what we're CONFIDENT is missing. Unverified → silent, because the page may already exist.)

- [ ] **Step 4: Run tests + typecheck.** `pnpm test src/lib/analyzers/__tests__/composite-score.test.ts && pnpm exec tsc --noEmit`

- [ ] **Step 5: Commit**
```bash
git add src/lib/analyzers/composite-score.ts src/lib/analyzers/__tests__/composite-score.test.ts
git commit -m "feat(scanner): suppress create-page recos for unverified E-E-A-T signals (Option B)"
```

---

## Task 8 (Option B, part 4): UI — 3-state badge + fixture + e2e

**Files:**
- Modify: `src/components/report/GeoTabContent.tsx`
- Modify: `src/app/e2e/report/page.tsx`
- Modify: `e2e/result-view.spec.ts`

- [ ] **Step 1: Generalize `StatusBadge` to 3 states**

Replace `StatusBadge` (`GeoTabContent.tsx:967-988`) with a `state`-aware version (keep an `ok` convenience for the schema panel which has no unverified concept):

```typescript
type BadgeState = 'present' | 'absent' | 'unverified';

function StatusBadge({ state, isFr }: { state: BadgeState; isFr: boolean }) {
  const cfg = {
    present:    { bg: 'var(--sa-green, #2d8e4f)', icon: '✓', label: isFr ? 'Présent' : 'Present' },
    absent:     { bg: 'var(--sa-ink-4)',          icon: '×', label: isFr ? 'Absent' : 'Absent' },
    unverified: { bg: 'var(--sa-amber-ink, #b88600)', icon: '?',
                  label: isFr ? 'Non vérifié — page inaccessible pendant l’analyse'
                              : 'Not verified — page unreachable during analysis' },
  }[state];
  return (
    <span aria-label={cfg.label} title={cfg.label}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, background: cfg.bg, color: 'var(--sa-cream)',
        fontSize: 16, fontWeight: 700, borderRadius: 0 }}>
      {cfg.icon}
    </span>
  );
}
```

In the Schema panel call site (`:588`), change `<StatusBadge ok={found} .../>` → `<StatusBadge state={found ? 'present' : 'absent'} .../>`.

- [ ] **Step 2: Thread `state` through `buildEeatGroups`**

Add `state?: BadgeState` to the `EeatSignal` interface. For the geo-driven signals, derive the merged state (metadata-present wins → 'present'; else fall to geo state). Update `buildEeatGroups`:

```typescript
// teamPage:
{ key:'teamPage', /*…*/, ok: geoSignals.teamPage.found, state: geoSignals.teamPage.state }

// contact (OR with metadata): present if metadata link exists, else geo state
{ key:'contactPage', /*…*/,
  ok: geoSignals.contactPage.found || !!metaEeat?.hasContactLink,
  state: metaEeat?.hasContactLink ? 'present' : geoSignals.contactPage.state }

// terms/legal (OR with metadata):
{ key:'terms', /*…*/,
  ok: geoSignals.legalMentions.found || !!metaEeat?.hasTermsOfService,
  state: metaEeat?.hasTermsOfService ? 'present' : geoSignals.legalMentions.state }

// testimonials:
{ key:'testimonials', /*…*/, ok: geoSignals.testimonials.found, state: geoSignals.testimonials.state,
  detail: geoSignals.testimonials.count > 0 ? `${geoSignals.testimonials.count} détecté(s)` : null }
```

Metadata-only signals (author, dates, privacy) have no `state` → default to `s.ok ? 'present' : 'absent'`.

In the render (`:807-846`), compute `const badgeState = s.state ?? (s.ok ? 'present' : 'absent');` and:
- pass `<StatusBadge state={badgeState} isFr={isFr} />`
- card border/background: treat `unverified` as neutral (not the green "ok" style and not a harsh negative) — e.g. `border: badgeState==='present' ? 'var(--sa-ok)' : badgeState==='unverified' ? 'var(--sa-amber-ink, #b88600)' : 'var(--sa-rule)'`, matching background tints.

Header count stays "X/N signaux présents" where X = signals with `badgeState==='present'`. Add, when any unverified exists, a small mono note in the panel header `right` slot: `· {k} non vérifié(s)` (FR) / `· {k} not verified` (EN).

- [ ] **Step 3: Update the e2e fixture** (`src/app/e2e/report/page.tsx:291-297`) to the new shape, including one `unverified` to exercise the badge:
```typescript
eeat: {
  score: 55,
  signals: {
    teamPage:      { found: true,  state: 'present' },
    legalMentions: { found: false, state: 'unverified' },   // ← exercises the amber badge
    contactPage:   { found: true,  state: 'present' },
    testimonials:  { found: false, state: 'absent', count: 0 },
  },
},
```
(Also fix the other fixture EEAT block if present near `:215`.)

- [ ] **Step 4: Add Playwright assertion** in `e2e/result-view.spec.ts` — navigate to the GEO tab and assert the "non vérifié" badge is visible:
```typescript
test('E-E-A-T panel renders a "non vérifié" badge for an unverified signal', async ({ page }) => {
  await page.goto('/e2e/report?tab=geo');           // match how other specs set the tab
  const badge = page.getByTitle(/non vérifié|not verified/i);
  await expect(badge.first()).toBeVisible();
});
```
> Implementer: align the navigation (URL `?tab=` value, or click the rail entry) with how `result-view.spec.ts` already opens the GEO tab.

- [ ] **Step 5: Run typecheck, unit, e2e**
```bash
pnpm exec tsc --noEmit
pnpm test
pnpm test:e2e   # or: pnpm exec playwright test (dev server on :3001)
```
Expected: all green.

- [ ] **Step 6: Commit**
```bash
git add src/components/report/GeoTabContent.tsx src/app/e2e/report/page.tsx e2e/result-view.spec.ts
git commit -m "feat(scanner): render 'non vérifié' E-E-A-T state in GEO tab + e2e (Option B UI)"
```

---

## Final review (after all tasks)

- [ ] Dispatch the project's **code-reviewer** AND **architect-reviewer** agents over the full branch diff (project policy: every diff goes through both before user's final validation).
- [ ] Full gate: `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm test:e2e`.
- [ ] Live dogfood on `enigma.swiss` (dev server :3001): the previously-timing-out `/fr/contact/` and `/fr/lequipe/` should now resolve to `present`, OR show **"non vérifié"** rather than a false "missing" + bogus "create page" reco. Confirm the GEO §10 E-E-A-T panel shows honest states.
- [ ] Open a PR (only when finished — user decision), summarizing A/B/C/D and the new honest 3-state.

---

## Decisions locked in (rationale for the reviewer)

1. **`unknown` vs `absent` boundary:** 404/410 + soft-404 = `absent` (confident); everything else non-ok (401/403/429/5xx) + timeout/abort/network/SSRF = `unknown`. Errs toward "unverified", never a false "absent".
2. **Empty candidate list = `absent`, not `unverified`:** with sitemap discovery (C) in place, a page that's neither linked nor in the sitemap is a strong (honest) signal of genuine absence. `unverified` is reserved for "we had a URL and couldn't read it".
3. **Score treats `unverified` as 0 points** (`found===false`): we do not credit what we couldn't verify. Conservative; the UI label + reco-suppression carry the honesty, not score inflation.
4. **Reco suppression only on `unverified`** (not on `absent`): we still tell a site to create a genuinely-missing team page; we just stop nagging about pages we couldn't reach.
5. **`eeatFallback` → all `unverified`:** a fully-failed analyzer hasn't verified anything; "unverified" is the honest fallback (was misleadingly all-absent).
6. **Sitemap: top-level `<loc>` only, no sitemap-index recursion, capped at 1000 locs.** Bounded cost; child-sitemap `.xml` locs harmlessly fail keyword matching. Recursion is explicitly out of scope.
7. **Concurrency cap = 6 per origin**, semaphore acquired after the SSRF guard, released in `finally` (covers timeout/abort). Per-origin so multi-site flows (PageSpeed/Google is a different origin) aren't throttled against each other.
8. **Retry = 1, transient-only** (`unknown`), never `absent`. Bounded extra latency (≤ one timeout), inside analyzer budgets.
