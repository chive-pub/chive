/**
 * Guards against server-side request forgery when fetching user-supplied URLs.
 *
 * @remarks
 * Several handlers fetch hosts that a caller controls: PDS registration probes
 * the submitted `pdsUrl`, and `did:web` resolution derives its host from the
 * caller's DID. Without a check, those become a request generator pointed at
 * whatever the server can reach but the caller cannot — cloud metadata at
 * `169.254.169.254`, `localhost` admin ports, or private RFC 1918 services.
 * Registration makes the reach persistent, since the host is stored and the
 * scanner returns to it later.
 *
 * Hostname inspection alone is not enough: a name under the caller's control
 * can resolve to a private address, and can resolve differently on a second
 * lookup. Every resolved address is therefore checked, and the caller is
 * expected to pass `redirect: 'error'` so a public host cannot bounce the
 * request inward.
 *
 * @packageDocumentation
 * @public
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Error raised when a URL is not safe for the server to fetch.
 *
 * @public
 */
export class SsrfBlockedError extends Error {
  /**
   * Creates an SSRF rejection.
   *
   * @param message - Human-readable reason the URL was rejected
   */
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

/**
 * Reports whether an IPv4 address is outside the publicly routable range.
 *
 * @param address - Dotted-quad IPv4 address
 * @returns True when the address is private, loopback, link-local or reserved
 */
function isPrivateIPv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }
  const [a = 0, b = 0] = parts;

  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a >= 224) return true; // multicast and reserved

  return false;
}

/**
 * Reports whether an IPv6 address is outside the publicly routable range.
 *
 * @param address - IPv6 address
 * @returns True when the address is loopback, unique-local, link-local or maps
 *   onto a non-public IPv4 address
 */
function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0] ?? '';

  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique-local
  if (normalized.startsWith('fe80')) return true; // link-local
  if (normalized.startsWith('ff')) return true; // multicast

  // IPv4-mapped (::ffff:169.254.169.254) reaches the same hosts as IPv4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped?.[1]) {
    return isPrivateIPv4(mapped[1]);
  }

  return false;
}

/**
 * Reports whether an IP address is safe for the server to connect to.
 *
 * @param address - IPv4 or IPv6 address
 * @returns True when the address is not publicly routable
 *
 * @public
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true; // not an IP literal at all: treat as unsafe
}

/**
 * Validates that a user-supplied URL is safe for the server to fetch.
 *
 * @param rawUrl - URL as supplied by the caller
 * @param options - `allowHttp` permits plain HTTP, for test stacks only
 * @returns The parsed URL when it passes every check
 * @throws SsrfBlockedError when the URL is malformed, uses a rejected scheme,
 *   carries embedded credentials, or resolves to a non-public address
 *
 * @public
 */
export async function assertFetchableUrl(
  rawUrl: string,
  options: { readonly allowHttp?: boolean } = {}
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('URL is not parseable');
  }

  const allowedProtocols = options.allowHttp ? ['https:', 'http:'] : ['https:'];
  if (!allowedProtocols.includes(url.protocol)) {
    throw new SsrfBlockedError(
      `URL scheme ${url.protocol} is not allowed; expected ${allowedProtocols.join(' or ')}`
    );
  }

  // Credentials in the URL are never appropriate here and can confuse parsers
  // that split on '@' differently from the one used for validation.
  if (url.username !== '' || url.password !== '') {
    throw new SsrfBlockedError('URL must not contain embedded credentials');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  // An IP literal is checked directly; there is nothing to resolve.
  if (isIP(hostname) !== 0) {
    if (isPrivateAddress(hostname)) {
      throw new SsrfBlockedError(`URL resolves to a non-public address (${hostname})`);
    }
    return url;
  }

  if (hostname.toLowerCase() === 'localhost' || hostname.toLowerCase().endsWith('.localhost')) {
    throw new SsrfBlockedError('URL resolves to a non-public address (localhost)');
  }

  let resolved: { address: string }[];
  try {
    resolved = await lookup(hostname, { all: true });
  } catch {
    throw new SsrfBlockedError(`Could not resolve host ${hostname}`);
  }

  if (resolved.length === 0) {
    throw new SsrfBlockedError(`Could not resolve host ${hostname}`);
  }

  // Every answer must be public: a name that resolves to both a public and a
  // private address would otherwise be reachable on a retry.
  for (const { address } of resolved) {
    if (isPrivateAddress(address)) {
      throw new SsrfBlockedError(`URL resolves to a non-public address (${address})`);
    }
  }

  return url;
}
