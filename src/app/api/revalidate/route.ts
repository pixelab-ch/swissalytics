import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { LOCALES, blogBase } from '@/lib/blog/types';

/**
 * Revalidation webhook. The CMS hub POSTs here on every article publish/update:
 *   POST /api/revalidate?secret=<REVALIDATE_SECRET>   body: { slug, site }
 * We purge the blog index of every locale, plus the article path of every locale
 * (an article may exist in fr/en/de/it). Without this, content still refreshes on the
 * next ISR cycle (hourly) — this just makes it immediate.
 */
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { slug } = (await req.json().catch(() => ({ slug: null }))) as { slug?: string | null };

  for (const locale of LOCALES) {
    revalidatePath(blogBase(locale));
    if (slug) revalidatePath(`${blogBase(locale)}/${slug}`);
  }

  return NextResponse.json({ ok: true, revalidated: true, slug: slug ?? null });
}
