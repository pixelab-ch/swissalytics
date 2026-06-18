import { describe, it, expect } from 'vitest';
import { mdToBlocks } from './md-to-blocks';

describe('mdToBlocks', () => {
  it('splits headings and paragraph runs', () => {
    const md = ['Intro paragraph.', '', '## Section A', '', 'Body of A.', '', '### Sub', '', 'Body of sub.'].join('\n');
    expect(mdToBlocks(md)).toEqual([
      { blockType: 'paragraph', md: 'Intro paragraph.' },
      { blockType: 'heading', level: '2', text: 'Section A' },
      { blockType: 'paragraph', md: 'Body of A.' },
      { blockType: 'heading', level: '3', text: 'Sub' },
      { blockType: 'paragraph', md: 'Body of sub.' },
    ]);
  });

  it('keeps lists and bold inside a single paragraph block (markdown preserved)', () => {
    const md = ['## Liste', '', '1. **Un.** premier', '1. **Deux.** second'].join('\n');
    const blocks = mdToBlocks(md);
    expect(blocks[0]).toEqual({ blockType: 'heading', level: '2', text: 'Liste' });
    expect(blocks[1].blockType).toBe('paragraph');
    expect(blocks[1].md).toContain('1. **Un.** premier');
    expect(blocks[1].md).toContain('1. **Deux.** second');
  });

  it('maps heading depth to level (## → 2, ### → 3, #### → 4)', () => {
    const levels = mdToBlocks('## A\n### B\n#### C')
      .filter((b) => b.blockType === 'heading')
      .map((b) => b.level);
    expect(levels).toEqual(['2', '3', '4']);
  });

  it('does not treat a single # (article title) as a body heading', () => {
    // bodies never contain an H1, but guard anyway: # stays in a paragraph
    const blocks = mdToBlocks('# Not a section\n\ntext');
    expect(blocks.every((b) => b.blockType === 'paragraph')).toBe(true);
  });

  it('returns no blocks for empty/whitespace input', () => {
    expect(mdToBlocks('   \n  \n')).toEqual([]);
  });
});
