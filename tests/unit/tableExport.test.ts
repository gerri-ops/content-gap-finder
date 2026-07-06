import { describe, expect, it } from "vitest";

import { buildMatrixRows } from "@/lib/export/tableExport";
import { buildPipeline } from "@/lib/matrix/pipeline";
import type { ProjectSettings, UrlRecord } from "@/lib/types";

const settings: ProjectSettings = {
  name: "Test",
  primaryDomain: "https://example.com",
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
  };
}

describe("buildMatrixRows", () => {
  it("builds one row per topic with location status icons", () => {
    const rows = [
      makeRecord({ status: "published", location: "Tampa" }, 1),
      makeRecord(
        {
          normalizedUrl: "https://example.com/orlando/car-accident-lawyer",
          originalUrl: "https://example.com/orlando/car-accident-lawyer",
          location: "Orlando",
          status: "needed",
        },
        2,
      ),
    ];
    const { matrix } = buildPipeline(rows, settings);
    const matrixRows = buildMatrixRows(matrix);

    expect(matrixRows).toHaveLength(matrix.topics.length);
    expect(matrixRows[0]).toHaveProperty("topic");
    expect(matrixRows[0]).toHaveProperty("Tampa");
    expect(matrixRows[0]).toHaveProperty("Orlando");
  });
});
