import { describe, expect, it } from "vitest";

import {
  formatPublishedDateForDisplay,
  resolvePublishedDate,
} from "@/lib/publishedDate";

describe("resolvePublishedDate", () => {
  it("returns the date only for published status", () => {
    expect(resolvePublishedDate("published", "2024-01-15")).toBe("2024-01-15");
    expect(resolvePublishedDate("in_progress", "2024-01-15")).toBeUndefined();
    expect(resolvePublishedDate("needed", "2024-01-15")).toBeUndefined();
  });

  it("trims whitespace and treats empty values as undefined", () => {
    expect(resolvePublishedDate("published", "  2024-01-15  ")).toBe("2024-01-15");
    expect(resolvePublishedDate("published", "   ")).toBeUndefined();
    expect(resolvePublishedDate("published")).toBeUndefined();
  });
});

describe("formatPublishedDateForDisplay", () => {
  it("returns an empty string when status is not published", () => {
    expect(formatPublishedDateForDisplay("in_progress", "2024-01-15")).toBe("");
    expect(formatPublishedDateForDisplay("needed", "2024-01-15")).toBe("");
  });

  it("returns the date string for published status", () => {
    expect(formatPublishedDateForDisplay("published", "2024-01-15")).toBe(
      "2024-01-15",
    );
    expect(formatPublishedDateForDisplay("published")).toBe("");
  });
});
