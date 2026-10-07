/**
 * safeFetch — the ONLY way to fetch a user-supplied (or user-derived) URL.
 *
 * Guarantees, per hop (initial request and every redirect):
 *   - `assertSafeUrl`: http/https only, ports 80/443 only, hostname blocklist,
 *     DNS resolved once and rejected if ANY address is private/reserved.
 *   - The socket is pinned to the vetted address (we connect to the IP
 *     literal; Host header and TLS SNI/certificate check use the hostname), so
 *     a second DNS answer can't swap in an internal address (DNS rebinding).
 *   - Redirects are followed manually (max `maxRedirects`), each target going
 *     through the same validation.
 *   - TLS certificates are verified (Node default — never disabled here).
 *   - Hard per-hop deadline, optional caller AbortSignal, body size cap
 *     (applied to the DECOMPRESSED bytes), optional HTML content-type check.
 */

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import type { Readable, Transform } from 'node:stream';
import { assertSafeUrl, type Resolver } from './ssrf';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MAX_REDIRECTS = 5;

export type SafeFetchErrorCode =
  | 'timeout'
  | 'aborted'
  | 'too-large'
  | 'too-many-redirects'
  | 'bad-content-type'
  | 'network';

export class SafeFetchError extends Error {
  constructor(message: string, public readonly code: SafeFetchErrorCode) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export interface SafeFetchOptions {
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  /** Hard deadline for EACH hop (connect + headers + body). */
  timeoutMs?: number;
  /** Max decompressed body size; exceeding it aborts the request. */
  maxBytes?: number;
  /** Redirects to follow; 0 returns the 3xx response as-is. */
  maxRedirects?: number;
  /** 'html' rejects a 2xx response whose Content-Type is set and is not HTML. */
  accept?: 'html' | 'any';
  /** false: don't download the body (status/headers only). Default true. */
  readBody?: boolean;
  signal?: AbortSignal;
  /** @internal test seam — DNS resolver. */
  resolve?: Resolver;
  /**
   * @internal test seam — maps the vetted (ip, port) to the socket actually
   * opened, so tests can route a "public" address to a local server while
   * the real validation logic still runs on the vetted address.
   */
  dial?: (ip: string, port: number) => { host: string; port: number };
}

export interface SafeResponse {
  status: number;
  statusText: string;
  ok: boolean;
  /** Final URL after redirects. */
  url: string;
  redirected: boolean;
  headers: Headers;
  text(): Promise<string>;
}

const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

function isHtmlContentType(value: string | null): boolean {
  if (!value) return true; // missing header: let the parser decide
  const mime = value.split(';')[0].trim().toLowerCase();
  return HTML_TYPES.includes(mime);
}

function toHeaders(raw: http.IncomingHttpHeaders): Headers {
  const h = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') h.set(key, value);
    else if (Array.isArray(value)) h.set(key, value.join(', '));
  }
  return h;
}

interface HopResult {
  status: number;
  statusText: string;
  headers: Headers;
  body: Buffer;
}

function decoderFor(encoding: string | null): Transform | null {
  switch ((encoding ?? '').trim().toLowerCase()) {
    case 'gzip':
    case 'x-gzip':
      return zlib.createGunzip();
    case 'deflate':
      return zlib.createInflate();
    case 'br':
      return zlib.createBrotliDecompress();
    default:
      return null;
  }
}

async function requestHop(
  target: URL,
  hostname: string,
  ip: string,
  port: number,
  opts: Required<Pick<SafeFetchOptions, 'method' | 'timeoutMs' | 'maxBytes' | 'readBody'>> &
    Pick<SafeFetchOptions, 'headers' | 'signal' | 'dial'>,
  isRedirect: (status: number, headers: Headers) => boolean,
): Promise<HopResult> {
  const isHttps = target.protocol === 'https:';
  const mod = isHttps ? https : http;
  const dialed = opts.dial ? opts.dial(ip, port) : { host: ip, port };

  return new Promise<HopResult>((resolve, reject) => {
    let settled = false;
    const finish = (err: Error | null, value?: HopResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      if (err) {
        req.destroy();
        reject(err);
      } else {
        resolve(value as HopResult);
      }
    };

    const onAbort = () => finish(new SafeFetchError('Requête annulée', 'aborted'));

    const req = mod.request(
      {
        host: dialed.host,
        port: dialed.port,
        path: target.pathname + target.search,
        method: opts.method,
        agent: false,
        headers: { ...opts.headers, Host: target.host },
        // TLS: SNI + certificate identity are checked against the hostname,
        // while the TCP connection goes to the vetted IP. Certificates ARE
        // verified — never disable this.
        rejectUnauthorized: true,
        ...(isHttps && !net.isIP(hostname) ? { servername: hostname } : {}),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const headers = toHeaders(res.headers);
        const base = { status, statusText: res.statusMessage ?? '', headers };

        if (!opts.readBody || opts.method === 'HEAD' || isRedirect(status, headers)) {
          finish(null, { ...base, body: Buffer.alloc(0) });
          // Never drain an unwanted body (status probes, redirects).
          req.destroy();
          return;
        }

        const decoder = decoderFor(headers.get('content-encoding'));
        const stream: Readable = decoder ? res.pipe(decoder) : res;
        if (decoder) {
          res.on('error', (e) => finish(e));
        }
        const chunks: Buffer[] = [];
        let total = 0;
        stream.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > opts.maxBytes) {
            const mb = Math.round(opts.maxBytes / (1024 * 1024));
            finish(new SafeFetchError(`Taille de la réponse trop importante (> ${mb} MB)`, 'too-large'));
            stream.destroy();
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () => finish(null, { ...base, body: Buffer.concat(chunks) }));
        stream.on('error', (e) => finish(e));
      },
    );

    const timer = setTimeout(
      () => finish(new SafeFetchError('Timeout: le site ne répond pas', 'timeout')),
      opts.timeoutMs,
    );
    if (opts.signal) {
      if (opts.signal.aborted) {
        onAbort();
        return;
      }
      opts.signal.addEventListener('abort', onAbort, { once: true });
    }
    req.on('error', (e) => finish(e));
    req.end();
  });
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Fetch a user-supplied URL with SSRF protection. Throws `SsrfError` when a
 * hop is refused by policy, `SafeFetchError` for timeout / abort / size /
 * redirect / content-type failures, and plain `Error` for network errors.
 * HTTP error statuses are NOT thrown — inspect `status` / `ok`.
 */
export async function safeFetch(input: string, options: SafeFetchOptions = {}): Promise<SafeResponse> {
  const method = options.method ?? 'GET';
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const hopOpts = {
    method,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
    readBody: options.readBody ?? true,
    headers: options.headers,
    signal: options.signal,
    dial: options.dial,
  };
  const followRedirects = maxRedirects > 0;
  const isRedirect = (status: number, headers: Headers) =>
    followRedirects && REDIRECT_STATUSES.has(status) && headers.has('location');

  let current = input;
  for (let hop = 0; ; hop++) {
    const vetted = await assertSafeUrl(current, { resolve: options.resolve });
    const res = await requestHop(vetted.url, vetted.hostname, vetted.resolvedIp, vetted.port, hopOpts, isRedirect);

    if (isRedirect(res.status, res.headers)) {
      if (hop >= maxRedirects) {
        throw new SafeFetchError('Trop de redirections', 'too-many-redirects');
      }
      current = new URL(res.headers.get('location') as string, vetted.url).href;
      continue;
    }

    const ok = res.status >= 200 && res.status < 300;
    if (ok && options.accept === 'html' && !isHtmlContentType(res.headers.get('content-type'))) {
      throw new SafeFetchError("Le contenu n'est pas une page HTML", 'bad-content-type');
    }

    const body = res.body;
    return {
      status: res.status,
      statusText: res.statusText,
      ok,
      url: vetted.url.href,
      redirected: hop > 0,
      headers: res.headers,
      text: async () => body.toString('utf-8'),
    };
  }
}
