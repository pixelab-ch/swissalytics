import { assertSafeUrl } from '@/lib/security/ssrf';

/**
 * Validates a URL for safe server-side fetching.
 * Blocks non-HTTP protocols and private/internal hosts (SSRF protection).
 *
 * P20 — SSRF guards consolidated: this delegates to the canonical
 * DNS-resolving `assertSafeUrl` (see `./security/ssrf.ts`), the single source
 * of truth for the private/loopback/link-local/metadata threat class. The
 * legacy hostname-prefix `isPrivateHost` / `isPrivateIP` implementation was
 * removed in favour of `assertSafeUrl`'s stricter CIDR + IPv4/IPv6 checks.
 *
 * Contract preserved for callers: async, resolves to `void` on a safe URL,
 * THROWS on any rejection (invalid URL, bad protocol, private/blocked host).
 * Every call site already does `try { await validateUrl(x) } catch { … }`, so
 * the thrown error type is intentionally not part of the contract — callers
 * only branch on whether it throws.
 */
export async function validateUrl(url: string): Promise<void> {
  await assertSafeUrl(url);
}

// P7.3 — `RateLimiter` class removed in favor of the unified
// `checkRateLimit` / `hasRecentAdmission` API in `./security/rateLimit.ts`.
// All 3 analyze endpoints now share a single sliding-window bucket
// (5/h + 50/day on /api/analyze, follow-up enrichment endpoints
// verify recent admission without consuming credits).
