import type { Metadata } from 'next';
import { BlogIndexView } from '@/components/blog/BlogIndexView';
import { buildListMetadata } from '@/lib/blog/page-meta';

export const metadata: Metadata = buildListMetadata('it');

export default function BlogIndexIt() {
  return <BlogIndexView locale="it" />;
}
