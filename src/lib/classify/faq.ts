import { getPathSegments } from "@/lib/normalize/url";
import type { UrlRecord } from "@/lib/types";

const FAQ_SEGMENT_PATTERN = /^(faqs?|frequently-asked-questions)$/i;
const FAQ_TOPIC_PATTERN = /\bfaqs?\b/i;

function normalizeSegment(segment: string): string {
  return decodeURIComponent(segment).toLowerCase().trim();
}

export function isFaqTopicName(topic?: string): boolean {
  if (!topic?.trim()) {
    return false;
  }

  const normalized = topic.trim().toLowerCase();
  const slugLike = normalized.replace(/\s+/g, "-");
  return FAQ_SEGMENT_PATTERN.test(slugLike) || FAQ_TOPIC_PATTERN.test(topic);
}

export function hasFaqPathSegment(normalizedUrl: string): boolean {
  const segments = getPathSegments(normalizedUrl).map(normalizeSegment);
  return segments.some(
    (segment) => FAQ_SEGMENT_PATTERN.test(segment) || segment.includes("faq"),
  );
}

export function isFaqContentType(contentType?: string): boolean {
  const type = contentType?.toLowerCase().trim();
  return type === "faq" || type === "faqs";
}

export function isFaqRow(
  record: Pick<UrlRecord, "normalizedUrl" | "topic" | "contentType" | "pageTitle">,
): boolean {
  if (isFaqContentType(record.contentType)) {
    return true;
  }

  if (record.pageTitle && FAQ_TOPIC_PATTERN.test(record.pageTitle)) {
    return true;
  }

  if (hasFaqPathSegment(record.normalizedUrl)) {
    return true;
  }

  if (record.topic && isFaqTopicName(record.topic)) {
    return true;
  }

  return false;
}
