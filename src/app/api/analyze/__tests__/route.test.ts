import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * POST /api/analyze — SSRF rejection contract.
 *
 * After the P20 SSRF-guard consolidation (validateUrl now delegates to the
 * canonical DNS-resolving `assertSafeUrl`), the route must STILL reject an
 * unsafe user-submitted URL with a 403 before any crawl/repo work — proving
 * the route's end-user behaviour is unchanged.
 *
 * `node:dns` is mocked so a public-looking hostname "resolves" to a private
 * IP (the DNS-rebinding bypass the guard exists to catch). Heavy deps are
 * stubbed so the test stays focused on the guard branch.
 */

const resolve4 = vi.fn(async (): Promise<string[]> => ['93.184.216.34']);
const resolve6 = vi.fn(async (): Promise<string[]> => {
  throw new Error('no AAAA');
});

vi.mock('node:dns', () => ({
  promises: {
    resolve4: () => resolve4(),
    resolve6: () => resolve6(),
  },
}));

const analyzePage = vi.fn();
vi.mock('@/lib/analyzer', () => ({ analyzePage: (...a: unknown[]) => analyzePage(...a) }));

const findRecent = vi.fn();
const getById = vi.fn();
vi.mock('@/lib/engine/repositoryInstance', () => ({
  getReportsRepo: () => ({ findRecent, getById }),
  DEDUP_WINDOW_MS: 60_000,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(url: string) {
  return new NextRequest('http://test/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

beforeEach(() => {
  resolve4.mockReset();
  resolve6.mockReset();
  resolve4.mockResolvedValue(['93.184.216.34']);
  resolve6.mockRejectedValue(new Error('no AAAA'));
  analyzePage.mockReset();
  findRecent.mockReset();
  getById.mockReset();
});

describe('POST /api/analyze — SSRF guard (post-consolidation)', () => {
  it('403 for a literal private/metadata IP, never crawls', async () => {
    const res = await POST(makeRequest('http://169.254.169.254/'));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/privé|bloqué|autorisée/i);
    expect(analyzePage).not.toHaveBeenCalled();
    expect(findRecent).not.toHaveBeenCalled();
  });

  it('403 for a public hostname that resolves to a private IP (DNS rebinding)', async () => {
    resolve4.mockResolvedValue(['10.0.0.5']);
    const res = await POST(makeRequest('https://rebind.example.com/'));
    expect(res.status).toBe(403);
    expect(analyzePage).not.toHaveBeenCalled();
  });

  it('403 for a .internal suffix host', async () => {
    const res = await POST(makeRequest('http://db.internal/'));
    expect(res.status).toBe(403);
    expect(analyzePage).not.toHaveBeenCalled();
  });

  it('passes the SSRF guard for a safe public URL (no 403)', async () => {
    resolve4.mockResolvedValue(['93.184.216.34']);
    findRecent.mockResolvedValue(null);
    analyzePage.mockResolvedValue(null); // crash later is fine; we only assert the guard let it through
    const res = await POST(makeRequest('https://example.com/'));
    expect(res.status).not.toBe(403);
    expect(findRecent).toHaveBeenCalled();
  });
});
