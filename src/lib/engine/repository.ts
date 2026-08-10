/**
 * ReportsRepository — persistence interface.
 *
 * Production impl: `SupabaseReportsRepository`, wired in `repositoryInstance.ts`.
 * Swap that one line to move to a different backend. The rest of the app
 * only depends on this interface.
 */

import type { CwvEnrichment, Lang, ReportSummary, StoredReport } from './types';
import type { GeoAnalysisResult } from '@/lib/analyzers/types';
import type { KeywordSuggestionsResult } from '@/lib/analyzers/keyword-suggestions';

/** Patch payload for enrich() — at least one field must be present. */
export interface EnrichPatch {
  geoAnalysis?: GeoAnalysisResult;
  cwv?: CwvEnrichment;
  /** P18.B — keyword suggestions persisted independently from geoAnalysis. */
  keywordSuggestions?: KeywordSuggestionsResult;
}

export interface ReportsRepository {
  /** Persist a new report. Throws on id collision. */
  save(report: StoredReport): Promise<void>;

  /** Fetch a report by id. Returns null if not found. */
  getById(id: string): Promise<StoredReport | null>;

  /**
   * Enable sharing on a report — sets `shareExpiresAt = expiresAt` and mints a
   * `shareToken` if the report does not already have one.
   *
   * The token MUST be independent of the report id. The share URL is the only
   * thing a recipient ever sees, so if it carried the id they could swap
   * /s/<id> for /r/<id> and read the report forever, past expiry and past
   * revocation. An opaque token is what makes the 30-day window and the revoke
   * button mean anything.
   *
   * An existing token is reused so that re-sharing extends the window instead
   * of silently breaking links already handed out. Rotation is the job of
   * disableSharing.
   *
   * Returns the updated StoredReport, or null if id not found.
   */
  enableSharing(id: string, expiresAt: number): Promise<StoredReport | null>;

  /**
   * Disable sharing — clears BOTH `shareExpiresAt` and `shareToken`.
   * Dropping the token is what makes revocation irreversible: re-enabling
   * mints a new one, so previously distributed links stay dead.
   * Returns the updated StoredReport, or null if id not found.
   */
  disableSharing(id: string): Promise<StoredReport | null>;

  /**
   * Fetch a report by SHARE TOKEN, only while sharing is live.
   * Used by the public /s/<token> route. Returns null if:
   *   - no row carries that token (revoked, or never shared)
   *   - shareExpiresAt is null (sharing disabled)
   *   - shareExpiresAt <= now (sharing expired)
   *
   * Takes a token, never an id — see enableSharing for why.
   */
  getSharedReport(token: string): Promise<StoredReport | null>;

  /**
   * Find the most recent report for a (url, lang) pair created within `maxAgeMs`.
   * Used for deduplication — if a site was analyzed < 1h ago, reuse it.
   * Returns null if none matches.
   */
  findRecent(
    url: string,
    lang: Lang,
    maxAgeMs: number,
  ): Promise<StoredReport | null>;

  /**
   * Delete reports older than `olderThanMs` AND expired share tokens.
   * Returns the number of deleted rows.
   */
  purge(olderThanMs: number): Promise<number>;

  /** Light metadata listing — used for admin/stats later. */
  listRecent(limit: number): Promise<ReportSummary[]>;

  /**
   * Patch the asynchronously-fetched enrichment (geoAnalysis + cwv).
   * Only the keys present in `patch` are written; missing keys are left untouched.
   * Returns the updated StoredReport, or null if id not found.
   */
  enrich(id: string, patch: EnrichPatch): Promise<StoredReport | null>;
}
