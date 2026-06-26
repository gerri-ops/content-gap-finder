import { getPathSegments } from "@/lib/normalize/url";

const EXCLUDED_SEGMENTS = [
  "blog",
  "news",
  "author",
  "tag",
  "tags",
  "category",
  "categories",
  "privacy",
  "terms",
  "policy",
  "search",
  "feed",
  "wp-content",
  "attachment",
  "team",
  "about",
];

const TRANSACTIONAL_HINTS = [
  "service",
  "services",
  "practice-area",
  "practice-areas",
  "location",
  "locations",
  "city",
  "county",
  "attorney",
  "lawyer",
  "consulting",
  "repair",
  "installation",
  "clinic",
  "treatment",
];

export function isTransactionalPage(
  normalizedUrl: string,
  contentType?: string,
): boolean {
  const type = contentType?.toLowerCase().trim();
  if (type) {
    if (["blog", "news", "article", "policy"].includes(type)) {
      return false;
    }
    if (["service", "product", "location", "practice-area"].includes(type)) {
      return true;
    }
  }

  const segments = getPathSegments(normalizedUrl).map((segment) =>
    decodeURIComponent(segment).toLowerCase(),
  );

  if (segments.some((segment) => EXCLUDED_SEGMENTS.includes(segment))) {
    return false;
  }

  return segments.some((segment) =>
    TRANSACTIONAL_HINTS.some((hint) => segment.includes(hint)),
  );
}
