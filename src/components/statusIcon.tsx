import type { ContentStatus } from "@/lib/types";

export function statusToIcon(status: ContentStatus): string {
  switch (status) {
    case "published":
      return "✅";
    case "in_progress":
      return "⏳";
    case "needed":
    default:
      return "🟢";
  }
}

export function statusToLabel(status: ContentStatus): string {
  switch (status) {
    case "published":
      return "Published";
    case "in_progress":
      return "In progress";
    case "needed":
    default:
      return "Content needed";
  }
}
