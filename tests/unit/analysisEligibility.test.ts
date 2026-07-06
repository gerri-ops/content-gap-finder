import { describe, expect, it } from "vitest";

import {
  isMatrixEligible,
  isTransactionalForAnalysis,
} from "@/lib/classify/analysisEligibility";
import type { UrlRecord } from "@/lib/types";

function makeRecord(partial: Partial<UrlRecord>): UrlRecord {
  return {
    id: "row-1",
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
    ...partial,
  };
}

describe("isTransactionalForAnalysis", () => {
  it("accepts transactional pages with include enabled", () => {
    expect(
      isTransactionalForAnalysis(
        makeRecord({ classification: "transactional", includeInAnalysis: true }),
      ),
    ).toBe(true);
  });

  it("rejects non-transactional pages even when include is checked", () => {
    expect(
      isTransactionalForAnalysis(
        makeRecord({
          classification: "non_transactional",
          includeInAnalysis: true,
        }),
      ),
    ).toBe(false);
  });

  it("rejects transactional pages opted out via include", () => {
    expect(
      isTransactionalForAnalysis(
        makeRecord({ classification: "transactional", includeInAnalysis: false }),
      ),
    ).toBe(false);
  });
});

describe("isMatrixEligible", () => {
  it("rejects FAQ transactional pages", () => {
    expect(
      isMatrixEligible(
        makeRecord({
          normalizedUrl: "https://example.com/tampa/car-accident-faq",
          topic: "Car Accident FAQ",
        }),
      ),
    ).toBe(false);
  });

  it("rejects non-transactional pages", () => {
    expect(
      isMatrixEligible(
        makeRecord({
          classification: "non_transactional",
          normalizedUrl: "https://example.com/blog/tampa-news",
          topic: "Tampa News",
        }),
      ),
    ).toBe(false);
  });
});
