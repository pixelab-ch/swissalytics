import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

/**
 * Stub the SSRF guard so the builder is deterministic (no real DNS) and can be
 * driven by a fetch stub. `buildPageContext` goes through the guarded
 * `fetchRealPage` (assertSafeUrl → fetch → soft-404 filter), exactly the path
 * the route uses to fetch the homepage ONCE before threading the context into
 * the sub-analyzers (eeat, schema-org).
 */
vi.mock('@/lib/security/ssrf', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security/ssrf')>(
    '@/lib/security/ssrf',
  );
  return {
    ...actual,
    assertSafeUrl: vi.fn(async (input: string) => ({
      url: new URL(input),
      hostname: new URL(input).hostname,
      resolvedIp: '93.184.216.34',
    })),
  };
});

import { buildPageContext } from '../page-discovery';
import { assertSafeUrl, SsrfError } from '@/lib/security/ssrf';

const assertSafeUrlMock = vi.mocked(assertSafeUrl);

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  assertSafeUrlMock.mockReset();
  assertSafeUrlMock.mockImplementation(async (input: string) => ({
    url: new URL(input),
    hostname: new URL(input).hostname,
    resolvedIp: '93.184.216.34',
  }));
});

const HOMEPAGE = `
  <html><head><title>Acme</title></head><body>
    <nav>
      <a href="/fr/lequipe/">L'équipe</a>
      <a href="/contact">Contact</a>
    </nav>
  </body></html>`;

const SOFT_404 = `<html><head><title>Page introuvable</title></head><body><h1>404</h1></body></html>`;

describe('buildPageContext', () => {
  it('fetches the homepage ONCE and returns html + parsed $ + extracted links', async () => {
    const fetchMock = vi.fn(async () => new Response(HOMEPAGE, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ctx = await buildPageContext('https://acme.com/');

    expect(ctx).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ctx!.url).toBe('https://acme.com/');
    expect(ctx!.html).toBe(HOMEPAGE);
    // Parsed cheerio API works off the same HTML.
    expect(ctx!.$('title').text()).toBe('Acme');
    // Links extracted from the real anchors.
    expect(ctx!.links).toEqual([
      { href: '/fr/lequipe/', text: "L'équipe" },
      { href: '/contact', text: 'Contact' },
    ]);
  });

  it('returns null on HTTP error (homepage unreachable) so analyzers can degrade', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    const ctx = await buildPageContext('https://down.com/');
    expect(ctx).toBeNull();
  });

  it('returns null on an HTTP-200 soft-404 (not a real homepage)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(SOFT_404, { status: 200 })));
    const ctx = await buildPageContext('https://soft.com/');
    expect(ctx).toBeNull();
  });

  it('returns null (never fetches) when the SSRF guard rejects the URL', async () => {
    assertSafeUrlMock.mockImplementation(async () => {
      throw new SsrfError('IP privée ou réservée', 'private-ip');
    });
    const fetchMock = vi.fn(async () => new Response(HOMEPAGE, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ctx = await buildPageContext('http://169.254.169.254/');
    expect(ctx).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
