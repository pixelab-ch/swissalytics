import type { Block } from './types';

/**
 * Convert a markdown article body into the hub's Block[] shape.
 *
 * - `## …` / `### …` / `#### …` lines become `heading` blocks (level = number of #).
 * - Every contiguous run of non-heading lines becomes one `paragraph` block whose `md`
 *   holds the raw markdown (lists, bold, links, tables…), rendered downstream by
 *   react-markdown + remark-gfm. This is lossless for the MDX bodies we migrate (plain
 *   markdown, no JSX components).
 *
 * Used by the MDX→hub migration script; pure and unit-tested.
 */
export function mdToBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const md = buffer.join('\n').trim();
    if (md) blocks.push({ blockType: 'paragraph', md });
    buffer = [];
  };

  for (const line of markdown.split('\n')) {
    const heading = line.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (heading) {
      flush();
      blocks.push({ blockType: 'heading', level: String(heading[1].length), text: heading[2] });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return blocks;
}
