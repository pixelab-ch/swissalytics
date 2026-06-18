import { describe, it, expect } from 'vitest';
import {
  blockMarkdown,
  blockText,
  bodyToPlainText,
  countTocHeadings,
  faqItems,
  headingProps,
  howToProps,
  imageProps,
  slugify,
} from './blocks';
import type { Block } from './types';

const paragraph = (md: string): Block => ({ blockType: 'paragraph', md });
const heading = (level: string, text: string): Block => ({ blockType: 'heading', level, text });

describe('blockText', () => {
  it('reads markdown from a paragraph block', () => {
    expect(blockText(paragraph('Hello **world**'))).toBe('Hello **world**');
  });

  it('reads text from a heading block', () => {
    expect(blockText(heading('2', 'Mission'))).toBe('Mission');
  });

  it('flattens faq questions and answers (q/a or question/answer)', () => {
    const faq: Block = { blockType: 'faq', items: [{ q: 'Why?', a: 'Because.' }] };
    expect(blockText(faq)).toContain('Why?');
    expect(blockText(faq)).toContain('Because.');
  });

  it('returns empty string for unknown blocks', () => {
    expect(blockText({ blockType: 'mystery' })).toBe('');
  });
});

describe('bodyToPlainText', () => {
  it('returns a string body unchanged', () => {
    expect(bodyToPlainText('plain mdx body')).toBe('plain mdx body');
  });

  it('joins block text for a structured body', () => {
    const out = bodyToPlainText([heading('2', 'Title'), paragraph('one two three')]);
    expect(out).toBe('Title\none two three');
  });
});

describe('countTocHeadings', () => {
  it('counts ## and ### in a markdown string', () => {
    expect(countTocHeadings('## A\n\ntext\n\n### B\n\n#### C')).toBe(2);
  });

  it('counts only h2/h3 heading blocks', () => {
    const body = [heading('2', 'A'), heading('3', 'B'), heading('4', 'C'), paragraph('x')];
    expect(countTocHeadings(body)).toBe(2);
  });
});

describe('slugify', () => {
  it('strips accents and punctuation, hyphenates spaces', () => {
    expect(slugify('Notre Mission')).toBe('notre-mission');
    expect(slugify('GEO & SEO : définitions')).toBe('geo-seo-definitions');
  });
  it('keeps the base letter when stripping an accent (é → e)', () => {
    expect(slugify('Référencement')).toBe('referencement');
  });
});

describe('headingProps', () => {
  it('maps a real heading block, anchor derived from text', () => {
    expect(headingProps({ blockType: 'heading', level: '2', text: 'Notre mission' })).toEqual({
      tag: 'h2',
      id: 'notre-mission',
      text: 'Notre mission',
    });
  });
  it('ignores the hub block id (a mongo hash) and slugifies the text for the anchor', () => {
    const h = headingProps({ blockType: 'heading', level: '3', text: 'Sources IA', id: '6a33e67adb52840001760716' });
    expect(h).toEqual({ tag: 'h3', id: 'sources-ia', text: 'Sources IA' });
  });
  it('caps unknown levels to h2 and returns null for empty text', () => {
    expect(headingProps({ blockType: 'heading', level: '7', text: 'X' })?.tag).toBe('h2');
    expect(headingProps({ blockType: 'heading', text: '' })).toBeNull();
  });
});

describe('faqItems', () => {
  it('accepts both {q,a} and {question,answer}', () => {
    const block: Block = {
      blockType: 'faq',
      items: [
        { q: 'A?', a: 'yes' },
        { question: 'B?', answer: 'no' },
      ],
    };
    expect(faqItems(block)).toEqual([
      { q: 'A?', a: 'yes' },
      { q: 'B?', a: 'no' },
    ]);
  });
  it('drops items missing a question or answer', () => {
    expect(faqItems({ blockType: 'faq', items: [{ q: 'only-q' }] })).toEqual([]);
  });
});

describe('howToProps', () => {
  it('maps name and steps', () => {
    const block: Block = { blockType: 'howTo', name: 'Install', steps: [{ name: 'Step 1', text: 'do' }] };
    expect(howToProps(block)).toEqual({ name: 'Install', steps: [{ name: 'Step 1', text: 'do' }] });
  });
});

describe('imageProps', () => {
  it('returns null without a resolved src', () => {
    expect(imageProps({ blockType: 'image' })).toBeNull();
  });
  it('passes through src/alt/caption and numeric dimensions', () => {
    expect(
      imageProps({ blockType: 'image', src: 'https://cms/x.webp', alt: 'a', caption: 'c', width: 800, height: 600 }),
    ).toEqual({ src: 'https://cms/x.webp', alt: 'a', caption: 'c', width: 800, height: 600 });
  });
});

describe('blockMarkdown', () => {
  it('reads paragraph md', () => {
    expect(blockMarkdown({ blockType: 'paragraph', md: 'hi' })).toBe('hi');
  });
  it('prefers table.markdown then falls back to md', () => {
    expect(blockMarkdown({ blockType: 'table', markdown: '| a |' })).toBe('| a |');
    expect(blockMarkdown({ blockType: 'table', md: '| b |' })).toBe('| b |');
  });
});
