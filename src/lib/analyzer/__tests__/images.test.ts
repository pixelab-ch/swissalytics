import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { analyzeImages } from '../images';

/**
 * Per-image issues must carry the *full resolved* src as `url`, so the report
 * UI (issues list + action plan) can preview/open the exact problematic media
 * even though the human-readable `message` truncates the URL to ~80 chars.
 */
function run(body: string, baseUrl = 'https://site.test/') {
  return analyzeImages(cheerio.load(`<html><body>${body}</body></html>`), baseUrl);
}

describe('analyzeImages — issue.url for problematic media', () => {
  it('attaches the full resolved src to a missing-alt issue', () => {
    const res = run('<img src="/media/photo.jpg">');
    const issue = res.issues.find((i) => /sans attribut alt/i.test(i.message));
    expect(issue?.url).toBe('https://site.test/media/photo.jpg');
  });

  it('keeps url full while the message stays truncated', () => {
    const long = '/assets/' + 'a'.repeat(120) + '.png';
    const res = run(`<img src="${long}">`);
    const issue = res.issues.find((i) => /sans attribut alt/i.test(i.message));
    expect(issue?.url).toBe('https://site.test' + long);
    expect(issue!.message.length).toBeLessThan(issue!.url!.length);
  });

  it('does not attach a url to aggregate (non per-image) issues', () => {
    const res = run('<img src="/a.jpg" alt="a"><img src="/b.jpg" alt="b">');
    const agg = res.issues.find((i) => /dimensions explicites/i.test(i.message));
    expect(agg).toBeDefined();
    expect(agg?.url).toBeUndefined();
  });
});
