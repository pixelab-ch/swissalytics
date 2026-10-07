import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { safeFetch, SafeFetchError, type SafeFetchOptions } from '../safe-fetch';
import { SsrfError } from '../ssrf';

/**
 * safeFetch against REAL local HTTP(S) servers.
 *
 * The SSRF policy forbids loopback, so tests use the two documented seams:
 *   - `resolve`: a fake DNS mapping test hostnames to addresses;
 *   - `dial`: routes the VETTED (public) address to the local server.
 * The validation, redirect handling, body cap, TLS and pinning logic all run
 * unmodified. `dial` is only reached for an address that passed validation,
 * so "dial never called with X" proves no socket was opened towards X.
 */

const PUBLIC_IP = '93.184.216.34';
const DNS: Record<string, string[]> = {
  'public.example': [PUBLIC_IP],
  'rebind.example': ['10.0.0.7'],
  'mixed.example': [PUBLIC_IP, '127.0.0.1'],
  'mapped.example': ['::ffff:169.254.169.254'],
  'mappedhex.example': ['::ffff:a9fe:a9fe'],
  'ula.example': ['fd00::1'],
};

const resolver = vi.fn(async (host: string) => DNS[host] ?? []);

let server: http.Server;
let tlsServer: https.Server;
let port = 0;
let tlsPort = 0;
const hits: string[] = [];
const hostHeaders: string[] = [];

let dial: ReturnType<typeof vi.fn<(ip: string, p: number) => { host: string; port: number }>>;

function opts(extra: SafeFetchOptions = {}): SafeFetchOptions {
  return { resolve: resolver, dial, timeoutMs: 2000, ...extra };
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    hits.push(url);
    hostHeaders.push(req.headers.host ?? '');
    const redirect = (location: string) => {
      res.writeHead(302, { Location: location });
      res.end();
    };
    switch (url) {
      case '/page':
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><title>ok</title></html>');
        return;
      case '/json':
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
        return;
      case '/to-page':
        return redirect('/page');
      case '/to-loopback':
        return redirect('http://127.0.0.1/admin');
      case '/to-loopback-port':
        return redirect(`http://127.0.0.1:${port}/secret`);
      case '/to-metadata':
        return redirect('http://169.254.169.254/latest/meta-data/');
      case '/to-rebind':
        return redirect('http://rebind.example/');
      case '/to-mapped':
        return redirect('http://[::ffff:127.0.0.1]/');
      case '/to-file':
        return redirect('file:///etc/passwd');
      case '/loop':
        return redirect('/loop');
      case '/big': {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        const chunk = Buffer.alloc(64 * 1024, 'a');
        let sent = 0;
        const pump = () => {
          while (sent < 4 * 1024 * 1024) {
            sent += chunk.length;
            if (!res.write(chunk)) {
              res.once('drain', pump);
              return;
            }
          }
          res.end();
        };
        res.on('error', () => undefined);
        pump();
        return;
      }
      case '/gzip-bomb': {
        res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Encoding': 'gzip' });
        res.end(zlib.gzipSync(Buffer.alloc(8 * 1024 * 1024, 0)));
        return;
      }
      case '/gzip-ok': {
        res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Encoding': 'gzip' });
        res.end(zlib.gzipSync(Buffer.from('<html>compressed</html>')));
        return;
      }
      case '/hang':
        return; // never responds
      default:
        res.writeHead(404);
        res.end('nf');
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;

  const fixtures = path.join(__dirname, 'fixtures');
  tlsServer = https.createServer(
    {
      key: fs.readFileSync(path.join(fixtures, 'self-signed-key.pem')),
      cert: fs.readFileSync(path.join(fixtures, 'self-signed-cert.pem')),
    },
    (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>tls</html>');
    },
  );
  await new Promise<void>((r) => tlsServer.listen(0, '127.0.0.1', r));
  tlsPort = (tlsServer.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  tlsServer.closeAllConnections();
  await new Promise((r) => server.close(r));
  await new Promise((r) => tlsServer.close(r));
});

beforeEach(() => {
  hits.length = 0;
  hostHeaders.length = 0;
  resolver.mockClear();
  dial = vi.fn((ip: string, p: number) => ({ host: '127.0.0.1', port: p === 443 ? tlsPort : port }));
});

describe('safeFetch — happy path', () => {
  it('fetches a public page, pinned to the vetted IP, Host header = hostname', async () => {
    const res = await safeFetch('http://public.example/page', opts({ accept: 'html' }));
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(await res.text()).toContain('<title>ok</title>');
    expect(dial).toHaveBeenCalledWith(PUBLIC_IP, 80);
    expect(hostHeaders).toEqual(['public.example']);
    // DNS resolved exactly once — the socket uses that answer, no re-lookup.
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('follows a same-site redirect and reports the final URL', async () => {
    const res = await safeFetch('http://public.example/to-page', opts());
    expect(res.status).toBe(200);
    expect(res.redirected).toBe(true);
    expect(res.url).toBe('http://public.example/page');
    expect(hits).toEqual(['/to-page', '/page']);
  });

  it('decodes a gzip body', async () => {
    const res = await safeFetch('http://public.example/gzip-ok', opts());
    expect(await res.text()).toBe('<html>compressed</html>');
  });

  it('returns HTTP error statuses without throwing', async () => {
    const res = await safeFetch('http://public.example/missing', opts());
    expect(res.status).toBe(404);
    expect(res.ok).toBe(false);
  });

  it('returns the 3xx as-is when maxRedirects is 0', async () => {
    const res = await safeFetch('http://public.example/to-page', opts({ maxRedirects: 0 }));
    expect(res.status).toBe(302);
    expect(hits).toEqual(['/to-page']);
  });
});

describe('safeFetch — redirect hops are re-validated', () => {
  it.each([
    ['/to-loopback', 'private-ip'],
    ['/to-loopback-port', 'bad-port'],
    ['/to-metadata', 'private-ip'],
    ['/to-rebind', 'private-ip'],
    ['/to-mapped', 'private-ip'],
    ['/to-file', 'bad-protocol'],
  ])('blocks redirect %s (%s)', async (p, code) => {
    await expect(safeFetch(`http://public.example${p}`, opts())).rejects.toMatchObject({
      name: 'SsrfError',
      code,
    });
    // Only the first (public) hop ever opened a socket.
    expect(dial).toHaveBeenCalledTimes(1);
    expect(hits).toEqual([p]);
  });

  it('stops after maxRedirects', async () => {
    await expect(safeFetch('http://public.example/loop', opts({ maxRedirects: 3 }))).rejects.toMatchObject({
      code: 'too-many-redirects',
    });
    expect(hits).toHaveLength(4);
  });
});

describe('safeFetch — initial URL policy (no socket opened)', () => {
  it.each([
    ['http://rebind.example/', 'private-ip'],
    ['http://mixed.example/', 'private-ip'],
    ['http://mapped.example/', 'private-ip'],
    ['http://mappedhex.example/', 'private-ip'],
    ['http://ula.example/', 'private-ip'],
    ['http://nx.example/', 'dns-fail'],
    ['http://127.0.0.1/', 'private-ip'],
    ['http://[::ffff:127.0.0.1]/', 'private-ip'],
    ['http://[::ffff:a9fe:a9fe]/', 'private-ip'],
    ['http://[::]/', 'private-ip'],
    ['http://0.0.0.0/', 'private-ip'],
    ['http://100.64.1.1/', 'private-ip'],
    ['http://[2002:7f00:1::1]/', 'private-ip'],
    ['http://public.example:8080/', 'bad-port'],
    ['ftp://public.example/', 'bad-protocol'],
    ['file:///etc/passwd', 'bad-protocol'],
    ['gopher://public.example/', 'bad-protocol'],
    ['data:text/html,hi', 'bad-protocol'],
  ])('rejects %s (%s)', async (url, code) => {
    const err = await safeFetch(url, opts()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SsrfError);
    expect(err).toMatchObject({ code });
    expect(dial).not.toHaveBeenCalled();
    expect(hits).toEqual([]);
  });
});

describe('safeFetch — response limits', () => {
  it('aborts an oversize body', async () => {
    const err = await safeFetch('http://public.example/big', opts({ maxBytes: 1024 * 1024 })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SafeFetchError);
    expect(err).toMatchObject({ code: 'too-large' });
  });

  it('applies the cap to decompressed bytes (gzip bomb)', async () => {
    const err = await safeFetch('http://public.example/gzip-bomb', opts({ maxBytes: 1024 * 1024 })).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'too-large' });
  });

  it('rejects a non-HTML content type when HTML is expected', async () => {
    await expect(safeFetch('http://public.example/json', opts({ accept: 'html' }))).rejects.toMatchObject({
      code: 'bad-content-type',
    });
    await expect(safeFetch('http://public.example/json', opts())).resolves.toMatchObject({ status: 200 });
  });

  it('times out a server that never answers', async () => {
    await expect(safeFetch('http://public.example/hang', opts({ timeoutMs: 300 }))).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('honours a caller AbortSignal', async () => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 100);
    await expect(
      safeFetch('http://public.example/hang', opts({ signal: ctrl.signal, timeoutMs: 5000 })),
    ).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('safeFetch — TLS', () => {
  it('verifies certificates (a self-signed cert is rejected)', async () => {
    const err = await safeFetch('https://public.example/', opts()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).toMatchObject({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
    expect(dial).toHaveBeenCalledWith(PUBLIC_IP, 443);
  });
});
