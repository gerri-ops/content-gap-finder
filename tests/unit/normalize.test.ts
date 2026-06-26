import { describe, expect, it } from "vitest";

import { normalizeUrl } from "@/lib/normalize/url";

describe("normalizeUrl", () => {
  it("normalizes protocol, host, and removes tracking params", () => {
    const normalized = normalizeUrl(
      "http://www.Example.com/Tampa/Truck-Accident-Lawyer/?utm_source=google#section",
    );
    expect(normalized).toBe("https://example.com/Tampa/Truck-Accident-Lawyer");
  });

  it("returns null for invalid URL", () => {
    expect(normalizeUrl("not-a-url:::")).toBeNull();
  });
});
