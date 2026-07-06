import { describe, expect, it } from "vitest";

import { isTransactionalPage } from "@/lib/classify/transactional";

describe("isTransactionalPage", () => {
  it("classifies service location URLs as transactional", () => {
    expect(
      isTransactionalPage("https://example.com/tampa/car-accident-lawyer"),
    ).toBe(true);
  });

  it("excludes blog and policy paths", () => {
    expect(isTransactionalPage("https://example.com/blog/tampa-news")).toBe(false);
    expect(isTransactionalPage("https://example.com/privacy-policy")).toBe(false);
  });

  it("honors explicit content type hints", () => {
    expect(
      isTransactionalPage("https://example.com/any/path", "blog"),
    ).toBe(false);
    expect(
      isTransactionalPage("https://example.com/any/path", "service"),
    ).toBe(true);
  });

  it("excludes generic pages without transactional hints", () => {
    expect(isTransactionalPage("https://example.com/contact")).toBe(false);
    expect(isTransactionalPage("https://example.com/thank-you")).toBe(false);
  });
});
