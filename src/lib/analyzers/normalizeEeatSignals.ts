/**
 * normalizeEeatSignals — backward-compat shim for legacy persisted E-E-A-T data.
 *
 * Reports persisted before the 3-state branch (2026-05-11 delivery) store the
 * OLD wire shape:
 *   - `legalMentions` was a bare `boolean` (e.g. `true` / `false`).
 *   - `teamPage`, `contactPage`, `testimonials` had `found` and optional extra
 *     fields but NO `state`.
 *
 * On read from Supabase the stored JSON is cast directly to `GeoAnalysisResult`;
 * without normalization a legacy row whose legal mentions were `true` now renders
 * as `{ found: undefined, state: undefined }` → shows as ABSENT (wrong).
 *
 * This module exports a SINGLE pure function `normalizeEeatSignals` that is
 * applied in `rowToStored` (the single choke point). Every consumer of a loaded
 * report gets the current 3-state shape, regardless of when the row was written.
 *
 * Normalisation rules
 * -------------------
 * 1. `legalMentions` is a bare boolean  → coerce to `{ found, state }`.
 * 2. Any signal missing `state`         → default `state` to `found ? 'present' : 'absent'`.
 * 3. `geo.eeat` absent/null             → leave as-is (old reports may lack it entirely).
 * 4. Signals already in the new shape   → pass through unchanged (idempotent).
 */

import type { SignalState } from './types';
import type { GeoAnalysisResult } from './types';

/**
 * Minimal shape of the legacy `eeat.signals` block as it may appear in the DB.
 * `legalMentions` can be `boolean` (old) or `{ found, state }` (new).
 */
type LegacyLegalMentions =
  | boolean
  | { found: boolean; state?: SignalState };

interface LegacySignalBase {
  found: boolean;
  state?: SignalState;
  [key: string]: unknown;
}

interface LegacyEeatSignals {
  teamPage?: LegacySignalBase;
  legalMentions?: LegacyLegalMentions;
  contactPage?: LegacySignalBase;
  testimonials?: LegacySignalBase;
  [key: string]: unknown;
}

/** Ensure a plain-object signal has `state`; preserves existing `found` + extras. */
function withState(sig: LegacySignalBase): LegacySignalBase & { state: SignalState } {
  const state: SignalState = sig.state ?? (sig.found ? 'present' : 'absent');
  return { ...sig, state };
}

/**
 * Normalise the `geo.eeat.signals` block of a `GeoAnalysisResult` loaded from
 * the database so every signal conforms to the current `{ found, state, … }`
 * shape, regardless of when the row was persisted.
 *
 * Safe to call on a `GeoAnalysisResult` that is already in the new shape — the
 * function is fully idempotent.
 */
export function normalizeEeatSignals(geo: GeoAnalysisResult): GeoAnalysisResult {
  // If there is no eeat block, nothing to normalise.
  const eeat = geo?.geo?.eeat;
  if (!eeat) return geo;

  const raw = eeat.signals as unknown as LegacyEeatSignals | undefined;
  if (!raw) return geo;

  // --- legalMentions: bare boolean → object ---
  let legalMentions: { found: boolean; state: SignalState };
  if (typeof raw.legalMentions === 'boolean') {
    const found = raw.legalMentions;
    legalMentions = { found, state: found ? 'present' : 'absent' };
  } else if (raw.legalMentions && typeof raw.legalMentions === 'object') {
    const lm = raw.legalMentions as { found: boolean; state?: SignalState };
    legalMentions = {
      found: lm.found,
      state: lm.state ?? (lm.found ? 'present' : 'absent'),
    };
  } else {
    // missing entirely — safe default
    legalMentions = { found: false, state: 'absent' };
  }

  // --- other three signals: add state if missing ---
  const teamPage = raw.teamPage ? withState(raw.teamPage) : undefined;
  const contactPage = raw.contactPage ? withState(raw.contactPage) : undefined;
  const testimonials = raw.testimonials ? withState(raw.testimonials) : undefined;

  type Signals = GeoAnalysisResult['geo']['eeat']['signals'];
  const signals: Signals = {
    ...(raw as unknown as Signals),
    ...(teamPage && { teamPage: teamPage as Signals['teamPage'] }),
    legalMentions,
    ...(contactPage && { contactPage: contactPage as Signals['contactPage'] }),
    ...(testimonials && { testimonials: testimonials as Signals['testimonials'] }),
  };

  return {
    ...geo,
    geo: {
      ...geo.geo,
      eeat: {
        ...eeat,
        signals,
      },
    },
  };
}
