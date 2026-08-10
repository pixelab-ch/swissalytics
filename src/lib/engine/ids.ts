/**
 * ID generation — URL-safe, non-sequential, collision-resistant.
 */

import { customAlphabet } from 'nanoid';

// lowercase+digits only to avoid ambiguous glyphs and make URLs tidy
const reportIdAlphabet = '23456789abcdefghijkmnpqrstuvwxyz';

const nanoReportId = customAlphabet(reportIdAlphabet, 12);

export function newReportId(): string {
  return nanoReportId();
}

/**
 * Share token — the ONLY identifier a share recipient ever sees.
 *
 * Deliberately longer than a report id and unrelated to it. Report ids are
 * human-readable slugs built from the analyzed hostname, which makes them
 * partly predictable; a share token must be guess-proof on its own, because
 * holding one grants read access to the full report until it expires.
 *
 * 24 chars over a 32-symbol alphabet ≈ 120 bits.
 */
const nanoShareToken = customAlphabet(reportIdAlphabet, 24);

export function newShareToken(): string {
  return nanoShareToken();
}
