/**
 * page-discovery — generic, link-driven page discovery for multi-page analyzers.
 *
 * The standard pattern (EEAT, testimonials, schema-org multipage):
 *   1. Fetch the submitted homepage ONCE.
 *   2. Read its REAL `<a href>` links (`extractLinks`).
 *   3. Resolve candidate sub-page URLs for a signal from those links, matched
 *      against accent-tolerant, locale-aware keywords (`candidateUrls`) — NOT
 *      from a hardcoded slug guess. Same-origin restricted, scheme-allowlisted,
 *      and capped at `MAX_CANDIDATES` to bound fan-out.
 *   4. Fetch each candidate via `fetchRealPage` (SSRF-guarded + abortable),
 *      skipping HTTP errors and HTTP-200 soft-404s (`looksLikeSoftError`).
 *
 * Pulled out of eeat.ts so the same discovery is reusable across analyzers
 * with identical behaviour. NO analyzer-specific logic lives here.
 */

import * as cheerio from 'cheerio';
import { assertSafeUrl, SsrfError } from '@/lib/security/ssrf';

/** A link extracted from a fetched page: href + visible anchor text. */
export interface PageLink {
  href: string;
  text: string;
}

/**
 * Shared page-type keyword sets — the SINGLE source of truth for link-driven
 * page discovery across analyzers (eeat, schema-org). Matched accent-tolerant
 * against link PATH SEGMENTS and anchor text (see `matchesKeyword`). Locale
 * prefixes (`/fr/`, `/de/`, …) and trailing slashes are handled by the segment
 * regex, so keywords here are bare slugs only.
 *
 * These previously lived (and drifted) in eeat.ts and schema-org.ts; both now
 * import from here so a slug added once is seen by every analyzer.
 *
 * Team includes the contracted French forms enigma.swiss uses (`lequipe`,
 * `l-equipe`, `léquipe`) on top of `equipe`/`équipe`.
 */
export const TEAM_KEYWORDS = [
  // FR
  'team', 'equipe', 'équipe', 'lequipe', 'l-equipe', 'léquipe',
  'notre-equipe', 'notre-équipe', 'a-propos', 'à-propos', 'apropos',
  'qui-sommes-nous', 'about', 'about-us',
  // DE
  'ueber-uns', 'über-uns', 'unternehmen',
  // IT
  'chi-siamo',
];

export const CONTACT_KEYWORDS = [
  'contact', 'contactez-nous', 'nous-contacter',
  'kontakt', 'contatti', 'contattaci',
];

export const LEGAL_KEYWORDS = [
  'mentions-legales', 'mentions-légales', 'impressum', 'datenschutz',
  'agb', 'privacy', 'privacy-policy', 'cgu', 'cgv', 'legal', 'legal-notice',
  'note-legali', 'imprint',
];

/**
 * Review / testimonial page slugs across the four CH locales (+ EN, which many
 * Swiss sites also serve). Matched the same way as the other signals:
 * accent-tolerant, on path segments and anchor text.
 */
export const TESTIMONIAL_KEYWORDS = [
  // FR
  'temoignages', 'témoignages', 'avis', 'references', 'références', 'clients',
  // EN
  'testimonials', 'reviews', 'case-studies', 'case-study',
  // DE
  'referenzen', 'kundenstimmen', 'bewertungen',
  // IT
  'testimonianze', 'recensioni',
];

const UA = 'Swissalytics/1.0 (+https://swissalytics.com)';

/** Outcome of a single page fetch, distinguishing definitive-absent from indeterminate. */
export type FetchOutcome =
  | { kind: 'ok'; html: string }
  | { kind: 'absent' }    // HTTP 404/410, or HTTP-200 soft-404 — page confidently not there
  | { kind: 'unknown' };  // timeout/abort/network err/SSRF reject/401/403/429/5xx — couldn't determine

/**
 * Per-fetch hard timeout (ms). Keeps sockets from outliving the analyzer's
 * overall `withTimeout` budget — see eeat I-2.
 *
 * Raised 4_000 → 8_000: small, valid sites (e.g. enigma.swiss) intermittently
 * take ~3.4s on a COLD first request — dangerously close to the old 4s abort.
 * Under the parallel-analyzer burst (lighthouse+seo+geo+schema+eeat hitting the
 * site at once, plus PageSpeed's headless browser warming it) those cold fetches
 * could exceed 4s and get aborted → reported as "page not found" / false
 * negatives (enigma's real `/fr/contact/`, `/fr/lequipe/`, even the homepage).
 * 8s gives ~2.3x margin over the 3.4s cold case while still bounding a truly
 * dead socket. The candidate-fetch parallelization (see `fetchFirstAvailable`)
 * keeps the worst-case wall per signal at ~one timeout, not N×, so raising this
 * does NOT blow the analyzer budget.
 */
export const FETCH_TIMEOUT_MS = 8_000;

/** Max candidate URLs fetched per signal — see eeat I-1 (route promises ≤3). */
export const MAX_CANDIDATES = 3;

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

/**
 * Registrable-domain-ish key for same-origin restriction (no PSL dependency):
 * exact hostname or its last two labels (`team.enigma.swiss` → `enigma.swiss`).
 * Good enough to keep candidate fetches on the analyzed site and drop
 * cross-origin links (e.g. an external `linkedin.com/.../about`).
 *
 * Known limitation: multi-part ccTLDs (e.g. `foo.co.uk` → key `co.uk`) are
 * treated imperfectly — a subdomain of a different `co.uk` registrant could
 * pass the same-site check. This is NOT an SSRF risk because `assertSafeUrl`
 * still blocks private/link-local/metadata IPs on every fetch downstream.
 */
function siteKey(hostname: string): string {
  const labels = hostname.toLowerCase().split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  return labels.slice(-2).join('.');
}

/**
 * True when `candidate` belongs to the same site as `pageUrl`: same exact
 * host, or sharing the same registrable domain (sub-domain of it).
 */
function isSameSite(candidate: URL, pageHost: string): boolean {
  const candHost = candidate.hostname.toLowerCase();
  const base = pageHost.toLowerCase();
  if (candHost === base) return true;
  return siteKey(candHost) === siteKey(base);
}

/**
 * Extract every `<a href>` link (href + trimmed anchor text) from a page.
 */
export function extractLinks($: cheerio.CheerioAPI): PageLink[] {
  const out: PageLink[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    out.push({ href, text: $(el).text().replace(/\s+/g, ' ').trim() });
  });
  return out;
}

/**
 * Path-segment / anchor-text keyword match.
 *
 * A keyword counts when it appears as a discrete path segment (bounded by
 * `/`, `-`, `_`, `.`, `?`, `#` or string ends) — so `/fr/lequipe/` and
 * `/about-us` match but `/teamwork-blog` does not — OR when it appears as a
 * whole word in the anchor text (e.g. opaque href `/p/42` with text
 * "Notre équipe"). Case- and accent-insensitive on both sides.
 */
export function matchesKeyword(link: PageLink, keywords: string[]): boolean {
  const href = link.href.toLowerCase();
  const text = link.text.toLowerCase();
  return keywords.some((kw) => {
    const k = kw.toLowerCase();
    const seg = new RegExp(`(?:^|[/_-])${escapeRe(k)}(?:[/._?#-]|$)`);
    if (seg.test(href)) return true;
    // Anchor-text fallback: keyword as a whole word (hyphens → spaces).
    const word = new RegExp(`(?:^|\\W)${escapeRe(k.replace(/-/g, ' '))}(?:\\W|$)`);
    return word.test(text);
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pick the best candidate link for a signal: the first link whose path or
 * anchor text matches one of the keywords. Returns null when none match.
 */
export function findBestCandidate(linksList: PageLink[], keywords: string[]): PageLink | null {
  return linksList.find((l) => matchesKeyword(l, keywords)) ?? null;
}

/**
 * Detect HTTP-200 soft-404 / error pages. Many sites (incl. enigma.swiss)
 * answer 200 for unknown routes and render a "not found" shell — trusting
 * `response.ok` alone yields false positives. We inspect the `<title>` and
 * any visible heading text for not-found markers.
 */
export function looksLikeSoftError(html: string, title: string): boolean {
  const $ = cheerio.load(html);
  const haystack = `${title} ${$('title').text()} ${$('h1, h2').text()}`.toLowerCase();
  return /\b404\b|not\s*found|page\s*introuvable|introuvable|nicht\s*gefunden|non\s*trovata|seite\s*nicht|page\s*non\s*trouv/i.test(
    haystack
  );
}

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

/**
 * Fetch a list of candidate URLs CONCURRENTLY and return the FIRST successful
 * (non-null, non-soft-404) page **in original candidate order**, together with
 * the URL it came from — or null when none resolved.
 *
 * Why concurrent: consumers used to fetch candidates SEQUENTIALLY, short-
 * circuiting on the first hit. With the per-fetch timeout raised to 8s, a
 * sequential loop over ≤3 candidates could take up to 3×8s = 24s in the worst
 * case (every earlier candidate slow / dead) — over the analyzer's 12s budget.
 * Fetching all candidates in one `Promise.all` burst makes the worst-case wall
 * ≈ ONE timeout (8s) regardless of how many candidates there are.
 *
 * Order semantics preserved: we still pick the EARLIEST matching candidate
 * (best = first link by document order), so behaviour is identical to the old
 * sequential "first success wins" — only faster. We deliberately do NOT race
 * (first-to-resolve), because that would let a fast soft-404-free secondary
 * page win over an equally valid but slightly slower primary candidate,
 * changing which page we attribute to the signal.
 *
 * Each fetch goes through the SSRF-guarded `fetchRealPage`, so all the safety
 * guarantees (assertSafeUrl, per-fetch abort, soft-404 filter) still hold.
 */
export async function fetchFirstAvailable(
  urls: string[],
): Promise<{ url: string; html: string } | null> {
  if (urls.length === 0) return null;
  const results = await Promise.all(urls.map((u) => fetchRealPage(u)));
  for (let i = 0; i < results.length; i++) {
    const html = results[i];
    if (html !== null) return { url: urls[i], html };
  }
  return null;
}

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

/**
 * Shared, fetched-ONCE view of the submitted homepage. Built by
 * `buildPageContext` (which goes through the guarded `fetchRealPage`) and
 * threaded into the sub-analyzers (eeat, schema-org) that would otherwise each
 * re-fetch and re-parse the same homepage. Sub-PAGE fetches (team/contact/
 * legal/testimonials/blog…) still go through `fetchRealPage` per analyzer —
 * only the HOMEPAGE refetch is eliminated.
 */
export interface PageContext {
  /** The submitted (already SSRF-validated) URL. */
  url: string;
  /** Raw homepage HTML (as returned by `fetchRealPage`). */
  html: string;
  /** Parsed homepage. */
  $: cheerio.CheerioAPI;
  /** Real `<a href>` links extracted from the homepage. */
  links: PageLink[];
  /** <loc> URLs parsed from the site's sitemap.xml (Option C); [] if none. */
  sitemapUrls: string[];
}

/**
 * Fetch + parse the submitted homepage ONCE through the guarded path
 * (`fetchRealPage` → `assertSafeUrl` + abort + soft-404 filter), returning a
 * `PageContext` reused by every sub-analyzer that reads the homepage. Returns
 * `null` when the homepage is unreachable / soft-404 / SSRF-rejected, so each
 * analyzer can degrade exactly as it did when it self-fetched and got null.
 *
 * Also fetches `${origin}/sitemap.xml` best-effort alongside the homepage parse
 * (never blocks or cancels the context). A missing or erroring sitemap yields [].
 */
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

/**
 * Resolve candidate URLs for a signal: prefer the real links found on the
 * submitted page (resolved against the page URL), optionally supplemented
 * with matching sitemap <loc> entries (Option C), falling back to a small
 * deduped list of guessed slugs only when neither source matched.
 */
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

  const pageHost = (() => {
    try {
      return new URL(pageUrl).hostname;
    } catch {
      return '';
    }
  })();

  // 1. Homepage links (existing logic, unchanged) — highest priority, doc order.
  //    Restricted to safe schemes AND the SAME SITE as the analyzed page.
  //    Dropping cross-origin links is both an SSRF defence (eeat C-1) and a
  //    correctness fix — an external `linkedin.com/.../about` is NOT the
  //    site's team page.
  for (const link of linksList) {
    if (!matchesKeyword(link, keywords)) continue;
    if (/^(tel:|mailto:|javascript:|#)/i.test(link.href)) continue;
    try {
      const abs = new URL(link.href, pageUrl);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
      if (pageHost && !isSameSite(abs, pageHost)) continue;
      push(abs.href);
    } catch {
      // ignore unparseable hrefs
    }
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

  // 3. Safety-net hardcoded probes ONLY when NEITHER source matched. (Same-origin
  //    by construction — built off baseUrl.)
  if (out.length === 0) {
    for (const slug of fallbackSlugs) push(`${baseUrl}/${slug}`);
  }

  // I-1: bound the fan-out so a page full of soft-404ing matches can't eat
  //      the whole fetch budget (route promises ≤3 candidate fetches/signal).
  return out.slice(0, MAX_CANDIDATES);
}
