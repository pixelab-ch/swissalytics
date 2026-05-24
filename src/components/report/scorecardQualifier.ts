/**
 * Returns a human-readable qualifier label for a scorecard score.
 * Thresholds align with scoreColor() in primitives.tsx:
 *   >= 80 → ok (Solide / Solid)
 *   >= 60 → warn (Correct / Fair)
 *    < 60 → red (À renforcer / Needs work)
 */
export interface Qualifier {
  label: string;
  loading: boolean;
}

export function scoreQualifier(score: number | null, isFr: boolean): Qualifier {
  if (score === null) {
    return { label: isFr ? 'calcul…' : 'computing…', loading: true };
  }
  if (score >= 80) return { label: isFr ? 'Solide' : 'Solid', loading: false };
  if (score >= 60) return { label: isFr ? 'Correct' : 'Fair', loading: false };
  return { label: isFr ? 'À renforcer' : 'Needs work', loading: false };
}
