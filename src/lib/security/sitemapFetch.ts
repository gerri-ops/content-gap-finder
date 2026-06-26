import dns from "node:dns/promises";
import net from "node:net";

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [ipToNumber("10.0.0.0"), ipToNumber("10.255.255.255")],
  [ipToNumber("172.16.0.0"), ipToNumber("172.31.255.255")],
  [ipToNumber("192.168.0.0"), ipToNumber("192.168.255.255")],
  [ipToNumber("127.0.0.0"), ipToNumber("127.255.255.255")],
  [ipToNumber("169.254.0.0"), ipToNumber("169.254.255.255")],
];

const MAX_SITEMAP_SIZE_BYTES = 2_000_000;

function ipToNumber(ip: string): number {
  return ip
    .split(".")
    .map(Number)
    .reduce((acc, octet) => (acc << 8) + octet, 0);
}

function isPrivateIpv4(ip: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    return false;
  }
  const value = ipToNumber(ip);
  return PRIVATE_IPV4_RANGES.some(([start, end]) => value >= start && value <= end);
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80")
  );
}

async function ensurePublicHost(hostname: string): Promise<void> {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Blocked private host.");
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length) {
    throw new Error("Could not resolve hostname.");
  }
  for (const record of records) {
    if (
      (net.isIPv4(record.address) && isPrivateIpv4(record.address)) ||
      (net.isIPv6(record.address) && isPrivateIpv6(record.address))
    ) {
      throw new Error("Blocked private network IP.");
    }
  }
}

function parseUrl(input: string): URL {
  const url = new URL(input);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Only HTTP/HTTPS sitemap URLs are allowed.");
  }
  return url;
}

async function readBodyWithLimit(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  let total = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > MAX_SITEMAP_SIZE_BYTES) {
      throw new Error("Sitemap response exceeds size limit.");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return new TextDecoder().decode(merged);
}

export async function fetchSitemapSafely(initialUrl: string): Promise<string> {
  let current = parseUrl(initialUrl);
  let redirects = 0;

  while (redirects <= 3) {
    await ensurePublicHost(current.hostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "content-gap-finder/1.0" },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("Redirect response missing location header.");
        }
        current = new URL(location, current);
        redirects += 1;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Sitemap fetch failed with status ${response.status}.`);
      }

      return await readBodyWithLimit(response);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Too many redirects while fetching sitemap.");
}
