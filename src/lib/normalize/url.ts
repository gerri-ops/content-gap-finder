const TRACKING_PREFIXES = [
  "utm_",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_",
  "_hs",
];

function shouldDropParam(key: string): boolean {
  const lower = key.toLowerCase();
  return TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export function slugToLabel(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function normalizeUrl(raw: string): string | null {
  const input = raw.trim();
  if (!input) {
    return null;
  }

  let candidate = input;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";

    for (const [key] of url.searchParams.entries()) {
      if (shouldDropParam(key)) {
        url.searchParams.delete(key);
      }
    }

    const pathname = url.pathname.replace(/\/{2,}/g, "/");
    const normalizedPathname =
      pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
    url.pathname = normalizedPathname || "/";
    url.search = url.searchParams.toString()
      ? `?${url.searchParams.toString()}`
      : "";

    return url.toString();
  } catch {
    return null;
  }
}

export function getPathSegments(normalizedUrl: string): string[] {
  const path = new URL(normalizedUrl).pathname;
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function getDomain(normalizedUrl: string): string {
  return new URL(normalizedUrl).hostname;
}

export function buildUrlFromPattern(
  baseDomain: string,
  preferredPattern: string,
  topic: string,
  location: string,
): string {
  const topicSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const locationSlug = location.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  let path = preferredPattern.trim().toLowerCase();
  if (!path.includes("{topic}") || !path.includes("{location}")) {
    path = "/{location}/{topic}";
  }

  path = path.replace("{topic}", topicSlug).replace("{location}", locationSlug);
  const cleanedPath = path.startsWith("/") ? path : `/${path}`;

  const base =
    normalizeUrl(baseDomain) ??
    normalizeUrl(`https://${baseDomain}`) ??
    "https://example.com";

  return new URL(cleanedPath, base).toString();
}
