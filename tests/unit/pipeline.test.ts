import { describe, expect, it } from "vitest";

import { buildPipeline } from "@/lib/matrix/pipeline";
import type { ProjectSettings, UrlRecord } from "@/lib/types";

const settings: ProjectSettings = {
  name: "Test",
  primaryDomain: "https://example.com",
  industry: "Legal",
  geographicTargetType: "city",
  targetLocations: ["Tampa", "Orlando"],
  preferredUrlPattern: "/{location}/{topic}",
};

function makeRecord(partial: Partial<UrlRecord>, index: number): UrlRecord {
  return {
    id: `row-${index}`,
    originalUrl: partial.originalUrl ?? "https://example.com/tampa/car-accident-lawyer",
    normalizedUrl:
      partial.normalizedUrl ?? "https://example.com/tampa/car-accident-lawyer",
    status: partial.status ?? "published",
    sourceType: partial.sourceType ?? "url_list",
    sourceName: partial.sourceName ?? "test",
    classification: partial.classification ?? "transactional",
    includeInAnalysis: partial.includeInAnalysis ?? true,
    topic: partial.topic ?? "Car Accident Lawyer",
    location: partial.location ?? "Tampa",
    pageTitle: partial.pageTitle,
    publishedDate: partial.publishedDate,
    contentType: partial.contentType,
    canonicalUrl: partial.canonicalUrl,
    lastUpdatedDate: partial.lastUpdatedDate,
    lastmod: partial.lastmod,
  };
}

describe("buildPipeline", () => {
  it("creates needed content rows for uncovered cells", () => {
    const rows = [
      makeRecord({}, 1),
      makeRecord(
        {
          normalizedUrl: "https://example.com/orlando/car-accident-lawyer",
          originalUrl: "https://example.com/orlando/car-accident-lawyer",
          location: "Orlando",
        },
        2,
      ),
      makeRecord(
        {
          normalizedUrl: "https://example.com/tampa/truck-accident-lawyer",
          originalUrl: "https://example.com/tampa/truck-accident-lawyer",
          topic: "Truck Accident Lawyer",
        },
        3,
      ),
    ];
    const result = buildPipeline(rows, settings);
    expect(result.topics).toContain("Truck Accident Lawyer");
    expect(result.locations).toContain("Orlando");
    expect(result.contentNeeded.length).toBeGreaterThan(0);
  });

  it("flags potential duplicates for same topic/location", () => {
    const rows = [
      makeRecord({}, 1),
      makeRecord(
        {
          normalizedUrl: "https://example.com/tampa/car-accident-attorney",
          originalUrl: "https://example.com/tampa/car-accident-attorney",
        },
        2,
      ),
    ];
    const result = buildPipeline(rows, settings);
    expect(result.duplicates.length).toBeGreaterThan(0);
  });
});
