import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fetchArticles, mapArticle } from '@/lib/blog/hub';

/**
 * LIVE integration test for the CMS hub (cms.pixelab.ch).
 *
 * Opt-in: runs only under `pnpm test:live` (RUN_LIVE_INTEGRATIONS=1). Mocks prove the
 * mapping logic; THIS proves the real API still answers and its real document shape
 * still maps cleanly — the kind of test that catches "the hub changed its schema" or
 * "the domain moved" before prod does.
 *
 * Note: swissalytics has no published hub articles yet, so we assert the API is reachable
 * and that *any* real published doc maps to a well-formed Article. Swap in the
 * swissalytics-scoped assertions once content is migrated.
 */
const HUB = 'https://cms.pixelab.ch';

describe.skipIf(process.env.RUN_LIVE_INTEGRATIONS !== '1')('LIVE hub', () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.PAYLOAD_URL;
    process.env.PAYLOAD_URL = HUB;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.PAYLOAD_URL;
    else process.env.PAYLOAD_URL = original;
  });

  it('the hub answers the swissalytics-scoped query without throwing', async () => {
    const list = await fetchArticles('fr');
    expect(Array.isArray(list)).toBe(true); // [] is fine — no swissalytics articles yet
  }, 15_000);

  it('a real published document maps to a well-formed Article', async () => {
    const res = await fetch(`${HUB}/api/articles?where[_status][equals]=published&depth=2&limit=1`, {
      headers: { accept: 'application/json' },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { docs?: Record<string, unknown>[] };
    const doc = json.docs?.[0];
    if (!doc) return; // hub empty — nothing to assert
    const article = mapArticle(doc, HUB);
    expect(article.slug).toBeTruthy();
    expect(article.title).toBeTruthy();
    expect(Array.isArray(article.body)).toBe(true);
  }, 15_000);
});
