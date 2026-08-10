/**
 * Permalink slug generation — human-readable, collision-resistant.
 *
 * Format: <hostname-slugified>-<10-char-suffix>
 * Examples:
 *   "https://pixelab.ch/about"        → "pixelab-ch-a8x4k2mq7n"
 *   "https://www.shop.example.com"    → "shop-example-com-x9k2bd4rt6"
 *
 * SUFFIX LENGTH: the hostname half is public knowledge, so the suffix is the
 * only thing standing between a curious party and someone else's report —
 * /r/<id> has no expiry or auth check. At 4 chars over this 32-symbol alphabet
 * that was ~1e6 guesses, enumerable for a targeted domain. 10 chars is ~1e15.
 *
 * Existing ids keep their 4-char suffix; this only applies to new reports.
 * Share links do not use this at all — see newShareToken() in ids.ts.
 */

import { customAlphabet } from 'nanoid';

const suffixAlphabet = '23456789abcdefghijkmnpqrstuvwxyz';
const nanoSuffix = customAlphabet(suffixAlphabet, 10);

const HOSTNAME_MAX = 40;

export function newReportSlug(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  const body = hostname
    .replace(/[^a-z0-9.-]/g, '')   // strip non-allowed
    .replace(/\./g, '-')           // dots → dashes (consecutive dashes from
                                   // punycode like `xn--` are preserved by design)
    .replace(/^-|-$/g, '')         // trim leading/trailing dash
    .substring(0, HOSTNAME_MAX);
  return `${body}-${nanoSuffix()}`;
}
