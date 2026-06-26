import path from "node:path";
import { test, expect } from "@playwright/test";

test("generates matrix and reports from CSV and pasted URLs", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Project name").fill("Legal Content Gap");
  await page
    .getByLabel("Target locations (comma-separated)")
    .fill("Tampa, Orlando, Miami");

  const csvPath = path.resolve("tests/fixtures/sample-pages.csv");
  await page.getByLabel("Upload CSV files").setInputFiles(csvPath);

  await page
    .getByLabel("Pasted URL list (one per line)")
    .fill("https://example.com/miami/car-accident-lawyer");

  await page.getByRole("button", { name: "Generate Content Gap Analysis" }).click();

  await expect(page.getByRole("heading", { name: "Content Gap Matrix" })).toBeVisible();
  await expect(page.getByText("Legend: ✅ Published")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Content Needed" })).toBeVisible();
});
