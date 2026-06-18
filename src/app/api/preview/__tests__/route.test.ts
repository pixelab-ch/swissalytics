import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const enableMock = vi.fn();
const disableMock = vi.fn();
vi.mock('next/headers', () => ({
  draftMode: vi.fn(async () => ({ enable: enableMock, disable: disableMock })),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { GET } from '../route';

const get = (qs: string) => new NextRequest(`http://localhost/api/preview${qs}`);

describe('GET /api/preview', () => {
  const ORIGINAL = process.env.PREVIEW_SECRET;
  beforeEach(() => {
    process.env.PREVIEW_SECRET = 'pv';
    enableMock.mockClear();
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PREVIEW_SECRET;
    else process.env.PREVIEW_SECRET = ORIGINAL;
  });

  it('rejects a wrong secret with 401 without enabling draft mode', async () => {
    const res = await GET(get('?secret=nope&slug=my-article'));
    expect(res.status).toBe(401);
    expect(enableMock).not.toHaveBeenCalled();
  });

  it('400s on a missing or invalid slug', async () => {
    expect((await GET(get('?secret=pv'))).status).toBe(400);
    expect((await GET(get('?secret=pv&slug=Bad_Slug'))).status).toBe(400);
    expect((await GET(get('?secret=pv&slug=de'))).status).toBe(400); // reserved locale prefix
  });

  it('enables draft mode and redirects to the localized article on a valid secret', async () => {
    await expect(GET(get('?secret=pv&slug=my-article&locale=en'))).rejects.toThrow('REDIRECT:/blog/en/my-article');
    expect(enableMock).toHaveBeenCalledOnce();
  });

  it('defaults to fr when the locale is missing or invalid', async () => {
    await expect(GET(get('?secret=pv&slug=my-article&locale=xx'))).rejects.toThrow('REDIRECT:/blog/my-article');
  });
});
