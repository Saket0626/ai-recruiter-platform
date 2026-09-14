import { BlockList, isIP } from "node:net";
import { lookup as defaultLookup } from "node:dns/promises";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export type DnsLookup = (
  hostname: string,
  options: { all: true },
) => Promise<Array<{ address: string; family: number }>>;

const blocked = new BlockList();
blocked.addSubnet("0.0.0.0", 8, "ipv4");
blocked.addSubnet("10.0.0.0", 8, "ipv4");
blocked.addSubnet("127.0.0.0", 8, "ipv4");
blocked.addSubnet("169.254.0.0", 16, "ipv4");
blocked.addSubnet("172.16.0.0", 12, "ipv4");
blocked.addSubnet("192.168.0.0", 16, "ipv4");
blocked.addSubnet("100.64.0.0", 10, "ipv4");
blocked.addAddress("::1", "ipv6");
blocked.addAddress("::", "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");
blocked.addSubnet("ff00::", 8, "ipv6");

function ipv4FromMapped(address: string): string | null {
  const lower = address.toLowerCase();
  const dotted = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1]!;
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const hi = Number.parseInt(hex[1]!, 16);
  const lo = Number.parseInt(hex[2]!, 16);
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

export function isBlockedIp(address: string): boolean {
  const mapped = ipv4FromMapped(address);
  if (mapped) return isBlockedIp(mapped);
  const version = isIP(address);
  if (version === 4) return blocked.check(address, "ipv4");
  if (version === 6) return blocked.check(address, "ipv6");
  return true;
}

function stripBrackets(hostname: string) {
  return hostname.replace(/^\[/, "").replace(/]$/, "").toLowerCase().replace(/\.$/, "");
}

export async function assertPublicHttpUrl(
  raw: string,
  deps: { lookup?: DnsLookup } = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("URL is not valid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only HTTP and HTTPS URLs can be fetched.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with credentials are blocked.");
  }
  await assertPublicHostname(url.hostname, deps);
  return url;
}

export async function assertPublicHostname(hostname: string, deps: { lookup?: DnsLookup } = {}) {
  const host = stripBrackets(hostname);
  if (!host) throw new UnsafeUrlError("Hostname is missing.");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new UnsafeUrlError("Loopback and local hostnames are blocked.");
  }
  if (isIP(host)) {
    if (isBlockedIp(host)) {
      throw new UnsafeUrlError(`Blocked private or metadata address ${host}.`);
    }
    return;
  }
  const lookup = deps.lookup ?? ((name: string) => defaultLookup(name, { all: true }));
  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError(`Could not resolve ${host}.`);
  }
  if (!records.length) throw new UnsafeUrlError(`Could not resolve ${host}.`);
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new UnsafeUrlError(`Blocked private or metadata address for ${host}.`);
    }
  }
}
