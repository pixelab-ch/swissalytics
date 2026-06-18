import type { Metadata } from 'next';
import { BlogIndexView } from '@/components/blog/BlogIndexView';
import { buildListMetadata } from '@/lib/blog/page-meta';

export const metadata: Metadata = buildListMetadata('de');

export default function BlogIndexDe() {
  return <BlogIndexView locale="de" />;
}
