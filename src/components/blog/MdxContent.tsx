import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { Faq } from './Faq';
import { HowTo } from './HowTo';

const components = { Faq, HowTo };

export function MdxContent({ source }: { source: string }) {
  return (
    <div className="blog-prose">
      <MDXRemote
        source={source}
        components={components}
        options={{ mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] } }}
      />
    </div>
  );
}
