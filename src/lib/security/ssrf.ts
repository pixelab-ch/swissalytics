/**
 * SSRF guard — validate URLs before crawling.
 *
 * Blocks:
 * - Non-http(s) protocols and non-standard ports (only 80 / 443)
 * - Loopback, link-local, RFC1918, CGNAT, multicast, documentation and other
 *   reserved IPv4 ranges (incl. 0.0.0.0/8 and 169.254.0.0/16 cloud metadata)
 * - Every IPv6 address outside global unicast 2000::/3 (::, ::1, ULA fc00::/7,
 *   link-local fe80::/10, multicast ff00::/8, NAT64, …), the reserved blocks
 *   inside it (Teredo, ORCHID, documentation), and IPv4-mapped / 6to4
 *   addresses whose embedded IPv4 is itself unsafe
 * - localhost-style names and .local / .internal / .localhost suffixes
 *
 * We resolve DNS and reject the URL if ANY resolved address is unsafe.
 * `assertSafeUrl` only VALIDATES; to actually fetch a user-supplied URL use
 * `safeFetch` (./safe-fetch.ts), which pins the socket to the vetted address
 * (no DNS rebinding window) and re-validates every redirect hop.
 */

import { promises as dns } from 'node:dns';
import net from 'node:net';

export class SsrfError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid-url'
      | 'bad-protocol'
      | 'bad-port'
      | 'private-ip'
      | 'dns-fail'
      | 'blocked-host',
  ) {
    super(message);
    this.name = 'SsrfError';
  }
}

/** Resolves a hostname to every A/AAAA address. Injectable for tests. */
export type Resolver = (hostname: string) => Promise<string[]>;

/** Ports a user-supplied URL may target. */
export const ALLOWED_PORTS: ReadonlySet<number> = new Set([80, 443]);

/** IPv4 private/reserved ranges (CIDR). */
const V4_UNSAFE: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],      // "this network"
  ['10.0.0.0', 8],     // RFC1918
  ['100.64.0.0', 10],  // CGNAT
  ['127.0.0.0', 8],    // loopback
  ['169.254.0.0', 16], // link-local / cloud metadata
  ['172.16.0.0', 12],  // RFC1918
  ['192.0.0.0', 24],   // IETF protocol assignments
  ['192.0.2.0', 24],   // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // RFC1918
  ['198.18.0.0', 15],  // benchmark
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4],    // multicast
  ['240.0.0.0', 4],    // reserved + broadcast
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return -1;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isUnsafeV4Int(n: number): boolean {
  return V4_UNSAFE.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0);
  });
}

function isUnsafeV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n < 0) return true; // unparseable — block
  return isUnsafeV4Int(n);
}

/** Parse an IPv6 literal (no brackets, no zone) into 16 bytes, or null. */
function parseIPv6(ip: string): number[] | null {
  if (!net.isIPv6(ip) || ip.includes('%')) return null;
  let head = ip;
  let v4Tail: number[] = [];
  const lastColon = ip.lastIndexOf(':');
  const tail = ip.slice(lastColon + 1);
  if (tail.includes('.')) {
    const n = ipv4ToInt(tail);
    if (n < 0) return null;
    v4Tail = [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    // Replace the dotted quad by two placeholder groups.
    head = `${ip.slice(0, lastColon + 1)}0:0`;
  }
  const [left, right] = head.includes('::') ? head.split('::') : [head, undefined];
  const leftGroups = left ? left.split(':') : [];
  const rightGroups = right !== undefined && right !== '' ? right.split(':') : [];
  const missing = 8 - leftGroups.length - rightGroups.length;
  if (right === undefined ? missing !== 0 : missing < 0) return null;
  const groups = [...leftGroups, ...Array<string>(right === undefined ? 0 : missing).fill('0'), ...rightGroups];
  if (groups.length !== 8) return null;
  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    const v = parseInt(g, 16);
    bytes.push((v >> 8) & 0xff, v & 0xff);
  }
  if (v4Tail.length) bytes.splice(12, 4, ...v4Tail);
  return bytes;
}

function v4FromBytes(b: number[], offset: number): number {
  return ((b[offset] << 24) | (b[offset + 1] << 16) | (b[offset + 2] << 8) | b[offset + 3]) >>> 0;
}

function isUnsafeV6(ip: string): boolean {
  const b = parseIPv6(ip);
  if (!b) return true; // unparseable or zoned — block

  // IPv4-mapped ::ffff:a.b.c.d — judged by the embedded IPv4.
  if (b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) {
    return isUnsafeV4Int(v4FromBytes(b, 12));
  }

  // Only global unicast 2000::/3 is reachable on the public internet. This
  // single rule covers ::, ::1, IPv4-compatible ::/96, NAT64 64:ff9b::/96,
  // discard 100::/64, ULA fc00::/7, link-local fe80::/10, site-local
  // fec0::/10 and multicast ff00::/8.
  if ((b[0] & 0xe0) !== 0x20) return true;

  const g0 = (b[0] << 8) | b[1];
  const g1 = (b[2] << 8) | b[3];
  if (g0 === 0x2001 && g1 === 0x0000) return true;            // Teredo 2001::/32
  if (g0 === 0x2001 && (g1 & 0xfff0) === 0x0010) return true; // ORCHID 2001:10::/28
  if (g0 === 0x2001 && (g1 & 0xfff0) === 0x0020) return true; // ORCHIDv2 2001:20::/28
  if (g0 === 0x2001 && g1 === 0x0db8) return true;            // documentation 2001:db8::/32
  if (g0 === 0x2001 && g1 === 0x0002 && b[4] === 0 && b[5] === 0) return true; // benchmark 2001:2::/48
  if (g0 === 0x2002) return isUnsafeV4Int(v4FromBytes(b, 2)); // 6to4 embeds an IPv4
  return false;
}

/** True when `ip` must never be connected to (private, reserved, or unparseable). */
export function isUnsafeIp(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '');
  if (net.isIPv4(bare)) return isUnsafeV4(bare);
  if (net.isIPv6(bare)) return isUnsafeV6(bare);
  return true; // unknown format — block
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'broadcasthost',
]);

/**
 * Hostname suffixes that always denote internal / non-public names and must
 * never be fetched, regardless of how (or whether) they resolve. Folded in
 * from the legacy `validateUrl` guard so consolidation loses no protection.
 */
const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.localhost'];

export const defaultResolver: Resolver = async (hostname) => {
  const ips: string[] = [];
  const [v4, v6] = await Promise.allSettled([dns.resolve4(hostname), dns.resolve6(hostname)]);
  if (v4.status === 'fulfilled') ips.push(...v4.value);
  if (v6.status === 'fulfilled') ips.push(...v6.value);
  return ips;
};

export interface SsrfValidatedUrl {
  url: URL;
  /** Lower-cased hostname without brackets or trailing dot. */
  hostname: string;
  /** Effective port (80 or 443). */
  port: number;
  /** Address the connection must be pinned to (IPv4 preferred). */
  resolvedIp: string;
  /** Every address the name resolved to — all of them were vetted. */
  resolvedIps: string[];
}

export interface AssertSafeUrlOptions {
  /** DNS resolver override (tests). */
  resolve?: Resolver;
}

/**
 * Validate a user-supplied URL for safe crawling.
 * Throws SsrfError on rejection.
 */
export async function assertSafeUrl(
  input: string,
  options: AssertSafeUrlOptions = {},
): Promise<SsrfValidatedUrl> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SsrfError('URL invalide', 'invalid-url');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError('Protocole non supporté', 'bad-protocol');
  }

  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    throw new SsrfError('Port non autorisé (80 ou 443 uniquement)', 'bad-port');
  }

  // `URL.hostname` keeps the brackets around IPv6 literals ("[::1]"), which
  // `net.isIP` rejects — strip them so bracketed IPv6 literals can't slip past
  // the literal-IP check into the DNS path. A trailing dot ("localhost.") is
  // the same name for DNS, so strip it before the blocklist checks.
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

  if (
    BLOCKED_HOSTS.has(hostname) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new SsrfError('Hôte bloqué', 'blocked-host');
  }

  // Literal IP host: check it directly, no DNS.
  if (net.isIP(hostname)) {
    if (isUnsafeIp(hostname)) {
      throw new SsrfError('IP privée ou réservée', 'private-ip');
    }
    return { url, hostname, port, resolvedIp: hostname, resolvedIps: [hostname] };
  }

  const resolve = options.resolve ?? defaultResolver;
  let ips: string[] = [];
  try {
    ips = await resolve(hostname);
  } catch {
    ips = [];
  }

  if (ips.length === 0) {
    throw new SsrfError('Impossible de résoudre le domaine', 'dns-fail');
  }

  for (const ip of ips) {
    if (isUnsafeIp(ip)) {
      throw new SsrfError('Domaine résout vers une IP privée', 'private-ip');
    }
  }

  const resolvedIp = ips.find((ip) => net.isIPv4(ip)) ?? ips[0];
  return { url, hostname, port, resolvedIp, resolvedIps: ips };
}
