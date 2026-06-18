import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Block } from '@/lib/blog/types';
import { blockMarkdown, faqItems, headingProps, howToProps, imageProps } from '@/lib/blog/blocks';
import { Faq } from './Faq';
import { HowTo } from './HowTo';

// Renders a hub-structured (Block[]) article body. Mirrors the MDX article styling by
// wrapping everything in `.blog-prose`. Untrusted CMS markdown goes through react-markdown
// (HTML escaped by default) — never MDX — so a stray `<` or `{` can't break the build.
// All field normalization lives in lib/blog/blocks.ts (pure, unit-tested); this component
// is a thin props→elements mapping layer.
export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="blog-prose">
      {blocks.map((block, i) => (
        <BlockSwitch key={block.id ?? i} block={block} />
      ))}
    </div>
  );
}

function BlockSwitch({ block }: { block: Block }) {
  switch (block.blockType) {
    case 'paragraph':
    case 'table': {
      const md = blockMarkdown(block);
      return md ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown> : null;
    }
    case 'heading': {
      const h = headingProps(block);
      if (!h) return null;
      const Tag = h.tag;
      return <Tag id={h.id}>{h.text}</Tag>;
    }
    case 'image': {
      const img = imageProps(block);
      if (!img) return null;
      return (
        <figure style={{ margin: '28px 0' }}>
          {img.width && img.height ? (
            <Image
              src={img.src}
              alt={img.alt}
              width={img.width}
              height={img.height}
              style={{ width: '100%', height: 'auto' }}
            />
          ) : (
            // Dimensions unknown (CMS didn't supply them) — fall back to a plain img.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.src} alt={img.alt} style={{ width: '100%', height: 'auto' }} />
          )}
          {img.caption && <figcaption style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>{img.caption}</figcaption>}
        </figure>
      );
    }
    case 'faq': {
      const items = faqItems(block);
      return items.length ? <Faq items={items} /> : null;
    }
    case 'howTo': {
      const { name, steps } = howToProps(block);
      return steps.length ? <HowTo name={name} steps={steps} /> : null;
    }
    default:
      // Unknown block type — degrade silently rather than break the page.
      return null;
  }
}
