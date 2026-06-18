import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

/** Leave Live Preview: disable Draft Mode and return to the blog index. */
export async function GET() {
  (await draftMode()).disable();
  redirect('/blog');
}
