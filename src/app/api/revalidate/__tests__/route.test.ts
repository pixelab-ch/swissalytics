import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { POST } from '../route';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const mockRevalidate = vi.mocked(revalidatePath);

function post(search: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/revalidate${search}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/revalidate', () => {
  const ORIGINAL = process.env.REVALIDATE_SECRET;
  beforeEach(() => {
    process.env.REVALIDATE_SECRET = 'sekret';
    mockRevalidate.mockClear();
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.REVALIDATE_SECRET;
    else process.env.REVALIDATE_SECRET = ORIGINAL;
  });

  it('rejects a wrong secret with 401 and revalidates nothing', async () => {
    const res = await POST(post('?secret=nope', { slug: 'x' }));
    expect(res.status).toBe(401);
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it('purges all four blog indexes when no slug is given', async () => {
    const res = await POST(post('?secret=sekret', {}));
    expect(res.status).toBe(200);
    expect(mockRevalidate.mock.calls.map((c) => c[0])).toEqual(['/blog', '/blog/en', '/blog/de', '/blog/it']);
  });

  it('purges every locale index AND article path when a slug is given', async () => {
    await POST(post('?secret=sekret', { slug: 'my-article', site: 'swissalytics' }));
    expect(mockRevalidate.mock.calls.map((c) => c[0])).toEqual([
      '/blog',
      '/blog/my-article',
      '/blog/en',
      '/blog/en/my-article',
      '/blog/de',
      '/blog/de/my-article',
      '/blog/it',
      '/blog/it/my-article',
    ]);
  });

  it('tolerates an empty/invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/revalidate?secret=sekret', { method: 'POST', body: 'not-json' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
