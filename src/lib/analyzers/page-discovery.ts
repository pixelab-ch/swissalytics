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

const UA = 'Swissalytics/1.0 (+https://swissalytics.com)';

/** Per-fetch hard timeout (ms). Keeps sockets from outliving the analyzer's
 *  overall `withTimeout` budget — see eeat I-2. */
export const FETCH_TIMEOUT_MS = 4_000;

/** Max candidate URLs fetched per signal — see eeat I-1 (route promises ≤3). */
export const MAX_CANDIDATES = 3;

/**
 * Registrable-domain-ish key for same-origin restriction (no PSL dependency):
 * exact hostname or its last two labels (`team.enigma.swiss` → `enigma.swiss`).
 * Good enough to keep candidate fetches on the analyzed site and drop
 * cross-origin links (e.g. an external `linkedin.com/.../about`).
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
 * Fetch a page once, returning its HTML — or null on HTTP error / soft-404.
 *
 * The URL may be derived from the (untrusted) analyzed page's links, so every
 * fetch passes through `assertSafeUrl` first (resolves DNS, blocks private /
 * link-local / metadata IPs) — see eeat C-1. An `SsrfError` (or any rejection
 * from the guard) is treated as "not found" rather than crashing the analyzer.
 * A per-fetch `AbortController` caps the socket lifetime so a slow host can't
 * outlive the analyzer's overall timeout (eeat I-2).
 */
export async function fetchRealPage(url: string): Promise<string | null> {
  try {
    await assertSafeUrl(url);
  } catch (err) {
    if (err instanceof SsrfError) {
      console.log(`[page-discovery] URL rejetée (SSRF): ${url} (${err.code})`);
      return null;
    }
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const html = await response.text();
    const title = cheerio.load(html)('title').text();
    if (looksLikeSoftError(html, title)) {
      console.log(`[page-discovery] Soft-404 rejeté: ${url}`);
      return null;
    }
    return html;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve candidate URLs for a signal: prefer the real links found on the
 * submitted page (resolved against the page URL), falling back to a small
 * deduped list of guessed slugs only when no link matched.
 */
export function candidateUrls(
  pageUrl: string,
  baseUrl: string,
  linksList: PageLink[],
  keywords: string[],
  fallbackSlugs: string[],
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

  // 1. Link-driven: matching links from the page, resolved absolute, but
  //    restricted to safe schemes AND the SAME SITE as the analyzed page.
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

  // 2. Safety-net hardcoded probes ONLY when no link matched. (Same-origin
  //    by construction — built off baseUrl.)
  if (out.length === 0) {
    for (const slug of fallbackSlugs) push(`${baseUrl}/${slug}`);
  }

  // I-1: bound the fan-out so a page full of soft-404ing matches can't eat
  //      the whole fetch budget (route promises ≤3 candidate fetches/signal).
  return out.slice(0, MAX_CANDIDATES);
}
