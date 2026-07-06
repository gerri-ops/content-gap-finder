import * as XLSX from "xlsx";

import { formatPublishedDateForDisplay } from "@/lib/publishedDate";
import type {
  DuplicatePair,
  GapMatrix,
  NeededContentRow,
  ProjectSettings,
  UrlRecord,
} from "@/lib/types";

function sanitizeSpreadsheetValue(value: unknown): string {
  const text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }
  return text;
}

function toDelimited<T extends object>(
  rows: T[],
  delimiter: "," | "\t",
): string {
  if (!rows.length) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const encodedHeaders = headers.map((header) => `"${header.replace(/"/g, '""')}"`);
  const lines = [encodedHeaders.join(delimiter)];

  rows.forEach((row) => {
    const keyedRow = row as Record<string, unknown>;
    const line = headers
      .map((header) => sanitizeSpreadsheetValue(keyedRow[header]))
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(delimiter);
    lines.push(line);
  });

  return lines.join("\n");
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function copyDelimited<T extends object>(rows: T[]): Promise<void> {
  const csv = toDelimited(rows, ",");
  return navigator.clipboard.writeText(csv);
}

export function exportRowsAsCsv<T extends object>(
  filename: string,
  rows: T[],
): void {
  downloadTextFile(filename, toDelimited(rows, ","), "text/csv;charset=utf-8");
}

export function exportRowsAsTsv<T extends object>(
  filename: string,
  rows: T[],
): void {
  downloadTextFile(filename, toDelimited(rows, "\t"), "text/tab-separated-values;charset=utf-8");
}

export function buildMatrixRows(matrix: GapMatrix): Array<Record<string, string>> {
  return matrix.topics.map((topic) => {
    const row: Record<string, string> = { topic };
    matrix.locations.forEach((location) => {
      const cell = matrix.cells[`${topic}|||${location}`];
      const statusIcon =
        cell.status === "published"
          ? "✅"
          : cell.status === "in_progress"
            ? "⏳"
            : "❓";
      row[location] = cell.hasPotentialDuplicate ? `${statusIcon} 🚩` : statusIcon;
    });
    return row;
  });
}

export function exportWorkbook(args: {
  filename: string;
  matrix: GapMatrix;
  contentNeeded: NeededContentRow[];
  duplicates: DuplicatePair[];
  inventory: UrlRecord[];
  settings: ProjectSettings;
}): void {
  const workbook = XLSX.utils.book_new();
  const matrixRows = buildMatrixRows(args.matrix);
  const neededRows = args.contentNeeded.map((row) => ({
    topic: row.topic,
    location: row.location,
    proposedTitle: row.proposedTitle,
    proposedUrl: row.proposedUrl,
    parentPage: row.parentPage,
    priority: row.priority,
    reason: row.reason,
    status: "❓",
  }));
  const duplicateRows = args.duplicates.map((duplicate) => ({
    urlA: duplicate.urlA,
    urlB: duplicate.urlB,
    reason: duplicate.reason,
    sharedTopic: duplicate.sharedTopic ?? "",
    sharedLocation: duplicate.sharedLocation ?? "",
    similarityScore: duplicate.similarityScore,
    reviewStatus: duplicate.reviewStatus,
    suggestedManualCheck: duplicate.suggestedManualCheck,
  }));
  const inventoryRows = args.inventory.map((row) => ({
    normalizedUrl: row.normalizedUrl,
    pageTitle: row.pageTitle ?? "",
    topic: row.topic ?? "",
    location: row.location ?? "",
    status:
      row.status === "published" ? "✅" : row.status === "in_progress" ? "⏳" : "❓",
    publishedDate: formatPublishedDateForDisplay(row.status, row.publishedDate),
    sourceName: row.sourceName,
    sourceType: row.sourceType,
    classification: row.classification,
  }));
  const settingsRows = [
    {
      name: args.settings.name,
      primaryDomain: args.settings.primaryDomain,
      industry: args.settings.industry,
      geographicTargetType: args.settings.geographicTargetType,
      targetLocations: args.settings.targetLocations.join(", "),
      preferredUrlPattern: args.settings.preferredUrlPattern,
    },
  ];

  const sheets = [
    { name: "Content Gap Matrix", rows: matrixRows },
    { name: "Content Needed", rows: neededRows },
    { name: "Potential Duplicates", rows: duplicateRows },
    { name: "Clean URL Inventory", rows: inventoryRows },
    { name: "Project Settings", rows: settingsRows },
  ];

  sheets.forEach(({ name, rows }) => {
    const sanitizedRows = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, sanitizeSpreadsheetValue(value)]),
      ),
    );
    const worksheet = XLSX.utils.json_to_sheet(sanitizedRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  });

  XLSX.writeFile(workbook, args.filename);
}
