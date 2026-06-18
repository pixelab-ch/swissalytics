import type { Article, Block } from './types';
import { isBlockBody } from './types';

/** Best-effort plain text from a single hub block, used for word counts / JSON-LD. */
export function blockText(block: Block): string {
  switch (block.blockType) {
    case 'paragraph':
      return typeof block.md === 'string' ? block.md : '';
    case 'heading':
      return typeof block.text === 'string' ? block.text : '';
    case 'table':
      return typeof block.markdown === 'string'
        ? block.markdown
        : typeof block.md === 'string'
          ? block.md
          : '';
    case 'faq': {
      const items = Array.isArray(block.items) ? block.items : [];
      return items
        .map((i: Record<string, unknown>) => `${str(i.question ?? i.q)} ${str(i.answer ?? i.a)}`)
        .join(' ');
    }
    case 'howTo': {
      const steps = Array.isArray(block.steps) ? block.steps : [];
      return `${str(block.name)} ${steps.map((s: Record<string, unknown>) => `${str(s.name)} ${str(s.text)}`).join(' ')}`;
    }
    case 'image':
      return `${str(block.caption)} ${str(block.alt)}`.trim();
    default:
      return '';
  }
}

/** Flatten any article body to plain text (string body returned as-is). */
export function bodyToPlainText(body: Article['body']): string {
  if (!isBlockBody(body)) return body;
  return body.map(blockText).join('\n').trim();
}

/** Count h2/h3 headings, matching the MDX heuristic the ToC uses to decide visibility. */
export function countTocHeadings(body: Article['body']): number {
  if (!isBlockBody(body)) return (body.match(/^#{2,3}\s/gm) || []).length;
  return body.filter(
    (b) => b.blockType === 'heading' && (String(b.level) === '2' || String(b.level) === '3'),
  ).length;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/* ---------- Pure block→props normalizers (consumed by the BlockRenderer) ---------- */

/** Slugify heading text for an anchor id. NFKD + ASCII filter strips accents/punctuation. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export type HeadingProps = { tag: 'h2' | 'h3' | 'h4'; id: string; text: string };

/** Resolve a heading block to a tag + anchor id, or null if it has no text. The anchor is
 *  always derived from the text (a hub block's `id` is a random Payload id, not an anchor;
 *  slugify reproduces the CMS's own text-derived anchors). */
export function headingProps(block: Block): HeadingProps | null {
  const text = str(block.text);
  if (!text) return null;
  const lvl = String(block.level);
  const tag = lvl === '3' ? 'h3' : lvl === '4' ? 'h4' : 'h2';
  return { tag, id: slugify(text), text };
}

/** Normalize a faq block's items to the {q,a} shape the Faq component expects. */
export function faqItems(block: Block): { q: string; a: string }[] {
  const raw = Array.isArray(block.items) ? block.items : [];
  return raw
    .map((i: Record<string, unknown>) => ({ q: str(i.question ?? i.q), a: str(i.answer ?? i.a) }))
    .filter((i) => i.q && i.a);
}

/** Normalize a howTo block to {name, steps[]}. */
export function howToProps(block: Block): { name: string; steps: { name: string; text: string }[] } {
  const raw = Array.isArray(block.steps) ? block.steps : [];
  const steps = raw
    .map((s: Record<string, unknown>) => ({ name: str(s.name), text: str(s.text) }))
    .filter((s) => s.name || s.text);
  return { name: str(block.name), steps };
}

export type ImageProps = { src: string; alt: string; caption: string; width?: number; height?: number };

/** Resolve an image block to renderable props, or null when it has no resolved src. */
export function imageProps(block: Block): ImageProps | null {
  const src = str(block.src);
  if (!src) return null;
  return {
    src,
    alt: str(block.alt),
    caption: str(block.caption),
    width: typeof block.width === 'number' ? block.width : undefined,
    height: typeof block.height === 'number' ? block.height : undefined,
  };
}

/** Markdown source for a paragraph or table block (empty string if none). */
export function blockMarkdown(block: Block): string {
  if (block.blockType === 'table') return str(block.markdown) || str(block.md);
  return str(block.md);
}
