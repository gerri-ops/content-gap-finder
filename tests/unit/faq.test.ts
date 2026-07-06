import { describe, expect, it } from "vitest";

import {
  hasFaqPathSegment,
  isFaqContentType,
  isFaqRow,
  isFaqTopicName,
} from "@/lib/classify/faq";

describe("isFaqTopicName", () => {
  it("detects FAQ topic labels", () => {
    expect(isFaqTopicName("FAQ")).toBe(true);
    expect(isFaqTopicName("faqs")).toBe(true);
    expect(isFaqTopicName("Car Accident Lawyer FAQ")).toBe(true);
    expect(isFaqTopicName("Car Accident Lawyer")).toBe(false);
  });
});

describe("hasFaqPathSegment", () => {
  it("detects FAQ URL path segments", () => {
    expect(hasFaqPathSegment("https://example.com/tampa/faq")).toBe(true);
    expect(hasFaqPathSegment("https://example.com/faqs/car-accident-lawyer")).toBe(
      true,
    );
    expect(hasFaqPathSegment("https://example.com/tampa/faqs/car-accident-lawyer")).toBe(
      true,
    );
    expect(hasFaqPathSegment("https://example.com/tampa/car-accident-lawyer-faq")).toBe(
      true,
    );
    expect(hasFaqPathSegment("https://example.com/tampa/car-accident-lawyer")).toBe(
      false,
    );
  });
});

describe("isFaqContentType", () => {
  it("detects FAQ content types", () => {
    expect(isFaqContentType("faq")).toBe(true);
    expect(isFaqContentType("FAQs")).toBe(true);
    expect(isFaqContentType("service")).toBe(false);
  });
});

describe("isFaqRow", () => {
  it("flags FAQ rows by topic, URL, or content type", () => {
    expect(
      isFaqRow({
        topic: "FAQ",
        normalizedUrl: "https://example.com/tampa/car-accident-lawyer",
      }),
    ).toBe(true);

    expect(
      isFaqRow({
        topic: "Car Accident Lawyer",
        normalizedUrl: "https://example.com/tampa/faq",
      }),
    ).toBe(true);

    expect(
      isFaqRow({
        topic: "Car Accident Lawyer",
        normalizedUrl: "https://example.com/tampa/car-accident-lawyer",
        contentType: "faq",
      }),
    ).toBe(true);

    expect(
      isFaqRow({
        topic: "Car Accident Lawyer",
        normalizedUrl: "https://example.com/tampa/car-accident-lawyer",
      }),
    ).toBe(false);
  });
});