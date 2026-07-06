import type { ContentStatus } from "@/lib/types";

export function resolvePublishedDate(
  status: ContentStatus,
  publishedDate?: string,
): string | undefined {
  if (status !== "published") {
    return undefined;
  }
  return publishedDate?.trim() || undefined;
}

export function formatPublishedDateForDisplay(
  status: ContentStatus,
  publishedDate?: string,
): string {
  return resolvePublishedDate(status, publishedDate) ?? "";
}
