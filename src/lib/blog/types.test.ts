import { describe, it, expect } from 'vitest';
import { ARTICLE_TYPES, articleSitemapPriority } from './types';

describe('articleSitemapPriority', () => {
  // Exact values from BLOG-HUB-WIRING.md §4.
  it.each([
    ['pillar', 0.9],
    ['authority', 0.8],
    ['guide', 0.8],
    ['versus', 0.8],
    ['comparison', 0.8],
    ['decision', 0.8],
    ['case-study', 0.7],
    ['glossary', 0.7],
    ['checklist', 0.7],
    ['news', 0.6],
  ] as const)('maps %s → %s', (type, expected) => {
    expect(articleSitemapPriority(type)).toBe(expected);
  });

  it('assigns a priority to every canonical article type', () => {
    for (const type of ARTICLE_TYPES) {
      const p = articleSitemapPriority(type);
      expect(p).toBeGreaterThanOrEqual(0.6);
      expect(p).toBeLessThanOrEqual(0.9);
    }
  });
});
