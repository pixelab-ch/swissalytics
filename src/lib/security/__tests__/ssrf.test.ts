import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * SSRF guard — canonical, DNS-resolving `assertSafeUrl` plus the legacy
 * `validateUrl` shim that now delegates to it (P20 consolidation).
 *
 * Literal-IP hosts never touch DNS, so the private-IP / protocol / blocked-host
 * matrix is tested directly. The "public domain resolves to a private IP"
 * bypass — the whole reason the guard resolves DNS — is tested with a mocked
 * `node:dns`.
 */

// DNS is mocked so the resolution path is deterministic (no real network).
// Default: a benign public A record. Individual tests override per hostname.
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

import { assertSafeUrl, SsrfError } from '../ssrf';
import { validateUrl } from '@/lib/security';

beforeEach(() => {
  resolve4.mockReset();
  resolve6.mockReset();
  resolve4.mockResolvedValue(['93.184.216.34']);
  resolve6.mockRejectedValue(new Error('no AAAA'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function expectSsrf(input: string, code?: SsrfError['code']) {
  await expect(assertSafeUrl(input)).rejects.toBeInstanceOf(SsrfError);
  if (code) {
    await expect(assertSafeUrl(input)).rejects.toMatchObject({ code });
  }
}

describe('assertSafeUrl — invalid input & protocol', () => {
  it('rejects an unparseable URL', async () => {
    await expectSsrf('not a url', 'invalid-url');
  });

  it('rejects non-http(s) protocols', async () => {
    await expectSsrf('ftp://example.com', 'bad-protocol');
    await expectSsrf('file:///etc/passwd', 'bad-protocol');
    await expectSsrf('gopher://example.com', 'bad-protocol');
  });

  it('accepts a plain public https URL', async () => {
    const r = await assertSafeUrl('https://example.com/page');
    expect(r.hostname).toBe('example.com');
    expect(r.resolvedIp).toBe('93.184.216.34');
  });
});

describe('assertSafeUrl — blocked hostnames & suffixes', () => {
  it('blocks localhost and ip6 loopback names', async () => {
    await expectSsrf('http://localhost/', 'blocked-host');
    await expectSsrf('http://ip6-localhost/', 'blocked-host');
    await expectSsrf('http://ip6-loopback/', 'blocked-host');
    await expectSsrf('http://broadcasthost/', 'blocked-host');
  });

  // Folded in from the legacy validateUrl guard — must not be lost.
  it('blocks .local / .internal / .localhost suffix hosts', async () => {
    await expectSsrf('http://printer.local/', 'blocked-host');
    await expectSsrf('http://db.internal/', 'blocked-host');
    await expectSsrf('http://api.localhost/', 'blocked-host');
  });
});

describe('assertSafeUrl — literal private/reserved IPv4 (no DNS)', () => {
  const privateV4 = [
    'http://127.0.0.1/',
    'http://10.0.0.1/',
    'http://10.255.255.255/',
    'http://172.16.0.1/',
    'http://172.31.255.255/',
    'http://192.168.1.1/',
    'http://169.254.169.254/', // cloud metadata
    'http://0.0.0.0/',
    'http://100.64.0.1/', // CGNAT
    'http://198.18.0.1/', // benchmark
    'http://224.0.0.1/', // multicast
    'http://240.0.0.1/', // reserved
  ];

  it.each(privateV4)('blocks %s', async (url) => {
    await expectSsrf(url, 'private-ip');
    // DNS must NOT be consulted for a literal IP host.
    expect(resolve4).not.toHaveBeenCalled();
  });

  it('allows a literal public IPv4', async () => {
    const r = await assertSafeUrl('http://93.184.216.34/');
    expect(r.resolvedIp).toBe('93.184.216.34');
    expect(resolve4).not.toHaveBeenCalled();
  });

  // 172.x outside the 16–31 second-octet RFC1918 window is public.
  it('allows 172.15.x and 172.32.x (outside RFC1918)', async () => {
    await expect(assertSafeUrl('http://172.15.0.1/')).resolves.toBeTruthy();
    await expect(assertSafeUrl('http://172.32.0.1/')).resolves.toBeTruthy();
  });
});

describe('assertSafeUrl — literal private IPv6 & IPv4-mapped (no DNS)', () => {
  it('blocks IPv6 loopback / ULA / link-local', async () => {
    await expectSsrf('http://[::1]/', 'private-ip');
    await expectSsrf('http://[fc00::1]/', 'private-ip');
    await expectSsrf('http://[fd12:3456::1]/', 'private-ip');
    await expectSsrf('http://[fe80::1]/', 'private-ip');
  });

  it('blocks IPv4-mapped IPv6 pointing at a private v4', async () => {
    await expectSsrf('http://[::ffff:127.0.0.1]/', 'private-ip');
    await expectSsrf('http://[::ffff:169.254.169.254]/', 'private-ip');
  });
});

describe('assertSafeUrl — DNS rebinding / resolved-IP bypass', () => {
  it('blocks a public hostname that resolves to a private IP (A record)', async () => {
    resolve4.mockResolvedValue(['10.0.0.5']);
    await expectSsrf('https://evil.example.com/', 'private-ip');
    expect(resolve4).toHaveBeenCalled();
  });

  it('blocks when ANY resolved IP is private (mixed answers)', async () => {
    resolve4.mockResolvedValue(['93.184.216.34', '127.0.0.1']);
    await expectSsrf('https://mixed.example.com/', 'private-ip');
  });

  it('blocks a public hostname resolving to a private IPv6 (AAAA record)', async () => {
    resolve4.mockRejectedValue(new Error('no A'));
    resolve6.mockResolvedValue(['fd00::1']);
    await expectSsrf('https://v6.example.com/', 'private-ip');
  });

  it('throws dns-fail (fail-closed) when nothing resolves', async () => {
    resolve4.mockRejectedValue(new Error('ENOTFOUND'));
    resolve6.mockRejectedValue(new Error('ENOTFOUND'));
    await expectSsrf('https://nx.example.com/', 'dns-fail');
  });

  it('allows a public hostname resolving to a public IP', async () => {
    resolve4.mockResolvedValue(['93.184.216.34']);
    const r = await assertSafeUrl('https://good.example.com/');
    expect(r.resolvedIp).toBe('93.184.216.34');
  });
});

describe('validateUrl — legacy shim delegates to assertSafeUrl', () => {
  it('resolves (void) for a safe public URL', async () => {
    resolve4.mockResolvedValue(['93.184.216.34']);
    await expect(validateUrl('https://example.com/')).resolves.toBeUndefined();
  });

  it('throws for a bad protocol', async () => {
    await expect(validateUrl('ftp://example.com')).rejects.toThrow();
  });

  it('throws for a literal private IP', async () => {
    await expect(validateUrl('http://169.254.169.254/')).rejects.toThrow();
  });

  it('throws for a .internal suffix host', async () => {
    await expect(validateUrl('http://db.internal/')).rejects.toThrow();
  });

  it('throws for a public host that resolves to a private IP', async () => {
    resolve4.mockResolvedValue(['192.168.0.10']);
    await expect(validateUrl('https://rebind.example.com/')).rejects.toThrow();
  });
});
