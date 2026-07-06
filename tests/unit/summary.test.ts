import { describe, expect, it } from "vitest";

import {
  buildCoverageDetailRows,
  buildCoverageSummaryRows,
  computeMatrixSummary,
  coverageExportFilename,
  iterMatrixCells,
} from "@/lib/matrix/summary";
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
    pageTitle: partial.pageTitle,
    publishedDate: partial.publishedDate,
    contentType: partial.contentType,
    canonicalUrl: partial.canonicalUrl,
    lastUpdatedDate: partial.lastUpdatedDate,
    lastmod: partial.lastmod,
  };
}

describe("computeMatrixSummary", () => {
  it("counts matrix cells by status at topic × location level", () => {
    const rows = [
      makeRecord({ status: "published", location: "Tampa" }, 1),
      makeRecord(
        {
          normalizedUrl: "https://example.com/orlando/car-accident-lawyer",
          originalUrl: "https://example.com/orlando/car-accident-lawyer",
          location: "Orlando",
          status: "in_progress",
        },
        2,
      ),
      makeRecord(
        {
          normalizedUrl: "https://example.com/tampa/truck-accident-lawyer",
          originalUrl: "https://example.com/tampa/truck-accident-lawyer",
          topic: "Truck Accident Lawyer",
          status: "published",
        },
        3,
      ),
    ];
    const { matrix } = buildPipeline(rows, settings);
    const summary = computeMatrixSummary(matrix);

    expect(summary.uniqueTopics).toBe(2);
    expect(summary.uniqueLocations).toBe(2);
    expect(summary.totalCells).toBe(4);
    expect(summary.published).toBe(2);
    expect(summary.inProgress).toBe(1);
    expect(summary.needed).toBe(1);
  });
});

describe("iterMatrixCells", () => {
  it("returns one cell per topic and location combination", () => {
    const rows = [makeRecord({}, 1)];
    const { matrix } = buildPipeline(rows, settings);
    const cells = iterMatrixCells(matrix);

    expect(cells).toHaveLength(2);
  });
});

describe("buildCoverageDetailRows", () => {
  it("omits /faqs/ URLs from coverage detail rows", () => {
    const rows = [
      makeRecord({}, 1),
      makeRecord(
        {
          normalizedUrl: "https://example.com/tampa/faqs/car-accident-lawyer",
          originalUrl: "https://example.com/tampa/faqs/car-accident-lawyer",
          topic: "Car Accident Lawyer",
          location: "Tampa",
        },
        2,
      ),
    ];
    const { matrix } = buildPipeline(rows, settings);
    const detailRows = buildCoverageDetailRows(matrix);

    expect(detailRows.every((row) => !/\/faqs(\/|$)/i.test(row.url))).toBe(true);
    expect(
      detailRows.find((row) => row.topic === "Car Accident Lawyer" && row.location === "Tampa")
        ?.url,
    ).toBe("https://example.com/tampa/car-accident-lawyer");
  });

  it("returns all matrix cells as flat rows", () => {
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
    const detailRows = buildCoverageDetailRows(matrix);

    expect(detailRows).toHaveLength(2);
    expect(detailRows.some((row) => row.status === "Published")).toBe(true);
    expect(detailRows.some((row) => row.status === "Content needed")).toBe(true);
  });

  it("filters detail rows by status", () => {
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
    const neededRows = buildCoverageDetailRows(matrix, "needed");

    expect(neededRows).toHaveLength(1);
    expect(neededRows[0]?.status).toBe("Content needed");
    expect(neededRows[0]?.location).toBe("Orlando");
  });
});

describe("buildCoverageSummaryRows", () => {
  it("exports summary metrics with descriptive labels", () => {
    const rows = [makeRecord({}, 1)];
    const { matrix } = buildPipeline(rows, settings);
    const summary = computeMatrixSummary(matrix);
    const exportRows = buildCoverageSummaryRows(summary);

    expect(exportRows).toHaveLength(6);
    expect(exportRows[0]?.metric).toContain("topic × location");
    expect(exportRows.some((row) => row.metric.includes("Unique topics"))).toBe(true);
  });
});

describe("coverageExportFilename", () => {
  it("builds slugged filenames per status filter", () => {
    expect(coverageExportFilename("My Project", "all", "csv")).toBe(
      "my-project-coverage-all.csv",
    );
    expect(coverageExportFilename("My Project", "in_progress", "xlsx")).toBe(
      "my-project-coverage-in-progress.xlsx",
    );
  });
});
