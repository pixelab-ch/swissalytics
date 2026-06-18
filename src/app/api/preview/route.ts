import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, blogBase, isLocale, isValidArticleSlug } from '@/lib/blog/types';

/**
 * Live Preview entry point. The CMS hub links editors here:
 *   GET /api/preview?secret=<PREVIEW_SECRET>&slug=<slug>&locale=<fr|en|de|it>
 * On a valid secret it enables Draft Mode (a cookie) and redirects to the article, which
 * then fetches the hub draft instead of the published version (see ArticleView).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  if (!process.env.PREVIEW_SECRET || sp.get('secret') !== process.env.PREVIEW_SECRET) {
    return new NextResponse('Invalid preview token', { status: 401 });
  }

  const slug = sp.get('slug');
  if (!slug || !isValidArticleSlug(slug)) {
    return new NextResponse('Missing or invalid slug', { status: 400 });
  }

  const localeParam = sp.get('locale');
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

  (await draftMode()).enable();
  redirect(`${blogBase(locale)}/${slug}`);
}
