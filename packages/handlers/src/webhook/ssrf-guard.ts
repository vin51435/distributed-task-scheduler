import * as dns from 'dns/promises';
import * as net from 'net';

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(`SSRF Security Guard Blocked Request: ${message}`);
    this.name = 'SsrfBlockedError';
  }
}

/**
 * Validates whether a target URL is safe against Server-Side Request Forgery (SSRF).
 * Blocks localhost, private subnets (RFC 1918), AWS/cloud metadata (169.254.169.254),
 * link-local addresses, CGNAT, and non-HTTP(S) protocols.
 */
export async function validateWebhookUrl(rawUrl: string): Promise<string> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new SsrfBlockedError('Webhook URL must be a non-empty string');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err: any) {
    throw new SsrfBlockedError(`Invalid URL format: ${err.message}`);
  }

  // 1. Enforce allowed protocols (http and https only)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(
      `Forbidden protocol '${parsed.protocol}'. Only http: and https: are permitted.`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject internal/loopback hostnames
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === '169.254.169.254' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.lan')
  ) {
    throw new SsrfBlockedError(`Access to internal/loopback host '${hostname}' is prohibited.`);
  }

  // 3. If hostname is directly an IP address literal, check it
  if (net.isIP(hostname)) {
    checkIpAddress(hostname);
    return parsed.toString();
  }

  // 4. Resolve DNS and check all resolved IP addresses
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new SsrfBlockedError(`Could not resolve hostname '${hostname}'`);
    }

    for (const addr of addresses) {
      checkIpAddress(addr.address);
    }
  } catch (err: any) {
    if (err instanceof SsrfBlockedError) {
      throw err;
    }
    throw new SsrfBlockedError(`DNS lookup failed for host '${hostname}': ${err.message}`);
  }

  return parsed.toString();
}

/**
 * Checks whether an IPv4 or IPv6 address belongs to private/reserved ranges.
 */
export function checkIpAddress(ip: string): void {
  // Check IPv4-mapped IPv6 address (::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    const mappedV4 = ip.substring(7);
    if (net.isIPv4(mappedV4)) {
      checkIPv4(mappedV4);
      return;
    }
  }

  if (net.isIPv4(ip)) {
    checkIPv4(ip);
  } else if (net.isIPv6(ip)) {
    checkIPv6(ip);
  } else {
    throw new SsrfBlockedError(`Invalid IP address format: ${ip}`);
  }
}

function checkIPv4(ip: string): void {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new SsrfBlockedError(`Invalid IPv4 address: ${ip}`);
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) {
    throw new SsrfBlockedError(`IP '${ip}' is in current network range (0.0.0.0/8)`);
  }

  // 10.0.0.0/8 (Private RFC 1918)
  if (a === 10) {
    throw new SsrfBlockedError(`IP '${ip}' is in private range (10.0.0.0/8)`);
  }

  // 127.0.0.0/8 (Loopback)
  if (a === 127) {
    throw new SsrfBlockedError(`IP '${ip}' is in loopback range (127.0.0.0/8)`);
  }

  // 100.64.0.0/10 (Shared Address Space / CGNAT)
  if (a === 100 && b >= 64 && b <= 127) {
    throw new SsrfBlockedError(`IP '${ip}' is in CGNAT range (100.64.0.0/10)`);
  }

  // 169.254.0.0/16 (Link-Local / Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) {
    throw new SsrfBlockedError(
      `IP '${ip}' is in link-local / cloud metadata range (169.254.0.0/16)`,
    );
  }

  // 172.16.0.0/12 (Private RFC 1918)
  if (a === 172 && b >= 16 && b <= 31) {
    throw new SsrfBlockedError(`IP '${ip}' is in private range (172.16.0.0/12)`);
  }

  // 192.168.0.0/16 (Private RFC 1918)
  if (a === 192 && b === 168) {
    throw new SsrfBlockedError(`IP '${ip}' is in private range (192.168.0.0/16)`);
  }

  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation / Test-Net)
  if (
    (a === 192 && b === 0 && parts[2] === 2) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113)
  ) {
    throw new SsrfBlockedError(`IP '${ip}' is in documentation/test range`);
  }

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) {
    throw new SsrfBlockedError(`IP '${ip}' is in multicast/reserved range`);
  }
}

function checkIPv6(ip: string): void {
  const normalized = ip.toLowerCase();

  // ::1 (Loopback)
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
    throw new SsrfBlockedError(`IP '${ip}' is IPv6 loopback (::1)`);
  }

  // :: (Unspecified)
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') {
    throw new SsrfBlockedError(`IP '${ip}' is IPv6 unspecified (::)`);
  }

  // fc00::/7 (Unique Local Address - ULA)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    throw new SsrfBlockedError(`IP '${ip}' is in IPv6 Unique Local range (fc00::/7)`);
  }

  // fe80::/10 (Link-Local)
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    throw new SsrfBlockedError(`IP '${ip}' is in IPv6 link-local range (fe80::/10)`);
  }
}
