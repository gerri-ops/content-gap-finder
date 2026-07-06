"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Papa from "papaparse";

import { DataTable } from "@/components/DataTable";
import { statusToIcon, statusToLabel } from "@/components/statusIcon";
import {
  copyDelimited,
  exportRowsAsCsv,
  exportRowsAsTsv,
  exportWorkbook,
  buildMatrixRows,
} from "@/lib/export/tableExport";
import {
  detectCsvMapping,
  parseCsvSource,
  parseSitemapXml,
  parseUrlList,
} from "@/lib/ingest/parsers";
import { buildPipeline } from "@/lib/matrix/pipeline";
import { formatPublishedDateForDisplay } from "@/lib/publishedDate";
import type {
  ContentStatus,
  CsvFieldMapping,
  CsvSourceFile,
  PipelineResult,
  ProjectSettings,
  SitemapSourceFile,
  UrlRecord,
} from "@/lib/types";

const CSV_FIELD_OPTIONS: Array<keyof CsvFieldMapping> = [
  "url",
  "pageTitle",
  "topic",
  "location",
  "status",
  "publishedDate",
  "contentType",
  "canonicalUrl",
  "lastUpdatedDate",
];

const FIELD_LABELS: Record<keyof CsvFieldMapping, string> = {
  url: "URL",
  pageTitle: "Page Title",
  topic: "Topic / Service",
  location: "Location",
  status: "Status",
  publishedDate: "Published Date",
  contentType: "Content Type",
  canonicalUrl: "Canonical URL",
  lastUpdatedDate: "Last Updated Date",
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

async function readFileAsText(file: File): Promise<string> {
  return file.text();
}

async function parseCsvHeaders(rawText: string): Promise<string[]> {
  return new Promise((resolve) => {
    Papa.parse(rawText, {
      header: true,
      preview: 1,
      complete: (result) => resolve((result.meta.fields as string[] | undefined) ?? []),
      error: () => resolve([]),
    });
  });
}

function parseDateForTooltip(value?: string): string {
  if (!value) {
    return "n/a";
  }
  return value;
}

export function ContentGapFinderApp() {
  const [project, setProject] = useState<ProjectSettings>({
    name: "Content Gap Project",
    primaryDomain: "https://example.com",
    geographicTargetType: "city",
    targetLocations: [],
    preferredUrlPattern: "/{location}/{topic}",
  });
  const [targetLocationsText, setTargetLocationsText] = useState("");

  const [csvSources, setCsvSources] = useState<CsvSourceFile[]>([]);
  const [sitemapSources, setSitemapSources] = useState<SitemapSourceFile[]>([]);
  const [sitemapUrlInput, setSitemapUrlInput] = useState("");
  const [urlListInput, setUrlListInput] = useState("");
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);

  const [inventory, setInventory] = useState<UrlRecord[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const inventoryColumns: ColumnDef<UrlRecord>[] = [
      {
        header: "URL",
        accessorKey: "normalizedUrl",
        cell: ({ row }) => (
          <a
            className="text-blue-700 underline"
            href={row.original.normalizedUrl}
            target="_blank"
            rel="noreferrer"
          >
            {row.original.normalizedUrl}
          </a>
        ),
      },
      {
        header: "Topic",
        accessorKey: "topic",
        cell: ({ row }) => (
          <input
            className="min-w-[10rem] rounded border border-slate-300 px-2 py-1"
            value={row.original.topic ?? ""}
            onChange={(event) =>
              updateInventoryRow(row.original.id, { topic: event.target.value || undefined })
            }
          />
        ),
      },
      {
        header: "Location",
        accessorKey: "location",
        cell: ({ row }) => (
          <input
            className="min-w-[8rem] rounded border border-slate-300 px-2 py-1"
            value={row.original.location ?? ""}
            onChange={(event) =>
              updateInventoryRow(row.original.id, { location: event.target.value || undefined })
            }
          />
        ),
      },
      {
        header: "Type",
        accessorKey: "classification",
        cell: ({ row }) => (
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={row.original.classification}
            onChange={(event) => {
              const value = event.target.value as UrlRecord["classification"];
              updateInventoryRow(row.original.id, { classification: value });
            }}
          >
            <option value="transactional">Transactional</option>
            <option value="non_transactional">Non-transactional</option>
          </select>
        ),
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={row.original.status}
            onChange={(event) => {
              const value = event.target.value as ContentStatus;
              updateInventoryRow(row.original.id, {
                status: value,
                ...(value !== "published" ? { publishedDate: undefined } : {}),
              });
            }}
          >
            <option value="published">✅ Published</option>
            <option value="in_progress">⏳ In progress</option>
            <option value="needed">{statusToIcon("needed")} Needed</option>
          </select>
        ),
      },
      {
        header: "Published Date",
        accessorKey: "publishedDate",
        cell: ({ row }) => {
          const isPublished = row.original.status === "published";
          return (
            <input
              className="rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100 disabled:text-slate-400"
              value={formatPublishedDateForDisplay(
                row.original.status,
                row.original.publishedDate,
              )}
              disabled={!isPublished}
              onChange={(event) =>
                updateInventoryRow(row.original.id, {
                  publishedDate: event.target.value || undefined,
                })
              }
            />
          );
        },
      },
      {
        header: "Include",
        accessorKey: "includeInAnalysis",
        cell: ({ row }) => (
          <input
            aria-label={`Include ${row.original.normalizedUrl}`}
            type="checkbox"
            checked={row.original.includeInAnalysis}
            onChange={(event) =>
              updateInventoryRow(row.original.id, { includeInAnalysis: event.target.checked })
            }
          />
        ),
      },
    ];

  const contentNeededColumns: ColumnDef<PipelineResult["contentNeeded"][number]>[] = [
      { header: "Topic", accessorKey: "topic" },
      { header: "Location", accessorKey: "location" },
      { header: "Proposed Title", accessorKey: "proposedTitle" },
      {
        header: "Proposed URL",
        accessorKey: "proposedUrl",
        cell: ({ row }) => (
          <a
            className="text-blue-700 underline"
            href={row.original.proposedUrl}
            target="_blank"
            rel="noreferrer"
          >
            {row.original.proposedUrl}
          </a>
        ),
      },
      { header: "Priority", accessorKey: "priority" },
      { header: "Reason", accessorKey: "reason" },
      { header: "Status", accessorKey: "status", cell: () => statusToIcon("needed") },
    ];

  const duplicateColumns: ColumnDef<PipelineResult["duplicates"][number]>[] = [
      { header: "URL A", accessorKey: "urlA" },
      { header: "URL B", accessorKey: "urlB" },
      { header: "Reason", accessorKey: "reason" },
      { header: "Shared Topic", accessorKey: "sharedTopic" },
      { header: "Shared Location", accessorKey: "sharedLocation" },
      { header: "Similarity", accessorKey: "similarityScore" },
      { header: "Review", accessorKey: "reviewStatus" },
      { header: "Suggested Check", accessorKey: "suggestedManualCheck" },
    ];

  function updateInventoryRow(id: string, patch: Partial<UrlRecord>) {
    setInventory((current) =>
      current.map((record) => (record.id === id ? { ...record, ...patch } : record)),
    );
  }

  function buildProjectForAnalysis(): ProjectSettings {
    return {
      ...project,
      targetLocations: targetLocationsText
        .split(",")
        .map((location) => location.trim())
        .filter(Boolean),
    };
  }

  function rerunWithManualEdits() {
    setGlobalError(null);
    setInventory((currentInventory) => {
      try {
        const nextProject = buildProjectForAnalysis();
        const updatedResult = buildPipeline(currentInventory, nextProject);
        setResult(updatedResult);
        setProject(nextProject);
        return updatedResult.cleanInventory;
      } catch (error) {
        setGlobalError(
          error instanceof Error ? error.message : "Unexpected re-run error.",
        );
        return currentInventory;
      }
    });
  }

  async function handleCsvUpload(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }
    setSourceErrors([]);
    const nextSources: CsvSourceFile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        errors.push(`${file.name}: only .csv files are accepted.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        errors.push(`${file.name}: exceeds 5MB upload limit.`);
        continue;
      }
      const rawText = await readFileAsText(file);
      const headers = await parseCsvHeaders(rawText);
      nextSources.push({
        id: `csv-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        headers,
        rawText,
        mapping: detectCsvMapping(headers),
      });
    }
    setCsvSources((current) => [...current, ...nextSources]);
    setSourceErrors(errors);
  }

  async function handleSitemapUpload(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }
    setSourceErrors([]);
    const nextSources: SitemapSourceFile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith(".xml")) {
        errors.push(`${file.name}: only .xml sitemap files are accepted.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        errors.push(`${file.name}: exceeds 5MB upload limit.`);
        continue;
      }
      nextSources.push({
        id: `sitemap-file-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        rawText: await readFileAsText(file),
      });
    }
    setSitemapSources((current) => [...current, ...nextSources]);
    setSourceErrors(errors);
  }

  async function fetchRemoteSitemapXml(url: string): Promise<string> {
    const response = await fetch("/api/fetch-sitemap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = (await response.json()) as { xml?: string; error?: string };
    if (!response.ok || !data.xml) {
      throw new Error(data.error ?? "Sitemap URL fetch failed.");
    }
    return data.xml;
  }

  async function runAnalysis() {
    setLoading(true);
    setGlobalError(null);
    try {
      const nextProject = buildProjectForAnalysis();

      const records: UrlRecord[] = [];
      csvSources.forEach((source) => {
        records.push(...parseCsvSource(source));
      });
      sitemapSources.forEach((source) => {
        records.push(...parseSitemapXml(source.rawText, source.name, source.id));
      });

      const sitemapUrls = sitemapUrlInput
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean)
        .slice(0, 20);
      for (const [index, sitemapUrl] of sitemapUrls.entries()) {
        const xml = await fetchRemoteSitemapXml(sitemapUrl);
        records.push(
          ...parseSitemapXml(xml, sitemapUrl, `sitemap-url-${index}`, "sitemap_url"),
        );
      }

      if (urlListInput.trim()) {
        records.push(...parseUrlList(urlListInput));
      }

      const built = buildPipeline(records, nextProject);
      setInventory(built.cleanInventory);
      setResult(built);
      setProject(nextProject);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Unexpected analysis error.");
    } finally {
      setLoading(false);
    }
  }

  const matrixRows = result ? buildMatrixRows(result.matrix) : [];

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 text-slate-900 md:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold">Content Gap Finder</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload CSV files, sitemap XML files, sitemap URLs, and pasted URLs to generate
          a clean transactional inventory, a topic x location gap matrix, a content-needed
          report, and a potential duplicate report.
        </p>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <label className="text-sm font-medium">
          Project name
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={project.name}
            onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <label className="text-sm font-medium">
          Primary domain
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={project.primaryDomain}
            onChange={(event) =>
              setProject((current) => ({ ...current, primaryDomain: event.target.value }))
            }
          />
        </label>
        <label className="text-sm font-medium">
          Geographic target type
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={project.geographicTargetType}
            onChange={(event) =>
              setProject((current) => ({
                ...current,
                geographicTargetType: event.target.value as ProjectSettings["geographicTargetType"],
              }))
            }
          >
            <option value="city">City</option>
            <option value="county">County</option>
            <option value="state">State</option>
          </select>
        </label>
        <label className="text-sm font-medium md:col-span-2">
          Target locations (comma-separated)
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            rows={2}
            value={targetLocationsText}
            onChange={(event) => setTargetLocationsText(event.target.value)}
            placeholder="Tampa, Orlando, Miami"
          />
        </label>
        <label className="text-sm font-medium md:col-span-2">
          Preferred URL pattern
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={project.preferredUrlPattern}
            onChange={(event) =>
              setProject((current) => ({ ...current, preferredUrlPattern: event.target.value }))
            }
            placeholder="/{location}/{topic}"
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Input Sources</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="rounded border border-dashed border-slate-300 p-3 text-sm">
            <span className="font-medium">Upload CSV files</span>
            <input
              className="mt-2 block w-full text-sm"
              multiple
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                void handleCsvUpload(event.target.files);
              }}
            />
          </label>
          <label className="rounded border border-dashed border-slate-300 p-3 text-sm">
            <span className="font-medium">Upload sitemap XML files</span>
            <input
              className="mt-2 block w-full text-sm"
              multiple
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={(event) => {
                void handleSitemapUpload(event.target.files);
              }}
            />
          </label>
        </div>

        <label className="text-sm font-medium">
          Sitemap URLs (one per line, max 20)
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            rows={3}
            value={sitemapUrlInput}
            onChange={(event) => setSitemapUrlInput(event.target.value)}
            placeholder="https://example.com/sitemap.xml"
          />
        </label>

        <label className="text-sm font-medium">
          Pasted URL list (one per line)
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            rows={4}
            value={urlListInput}
            onChange={(event) => setUrlListInput(event.target.value)}
            placeholder="https://example.com/location/topic"
          />
        </label>

        {sourceErrors.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {sourceErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}

        <button
          className="w-fit rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => {
            void runAnalysis();
          }}
          disabled={loading}
        >
          {loading ? "Running analysis..." : "Generate Content Gap Analysis"}
        </button>
        {globalError ? <p className="text-sm text-red-700">{globalError}</p> : null}
      </section>

      {csvSources.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">CSV Field Mapping</h2>
          <p className="mb-3 text-sm text-slate-600">
            Review each file mapping so URL, status, topic, and location fields are
            interpreted correctly.
          </p>
          <div className="space-y-4">
            {csvSources.map((source) => (
              <div key={source.id} className="rounded border border-slate-200 p-3">
                <h3 className="font-medium">{source.name}</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {CSV_FIELD_OPTIONS.map((fieldKey) => (
                    <label key={`${source.id}-${fieldKey}`} className="text-xs font-medium">
                      {FIELD_LABELS[fieldKey]}
                      <select
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={source.mapping[fieldKey] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value || undefined;
                          setCsvSources((current) =>
                            current.map((item) =>
                              item.id === source.id
                                ? {
                                    ...item,
                                    mapping: { ...item.mapping, [fieldKey]: value },
                                  }
                                : item,
                            ),
                          );
                        }}
                      >
                        <option value="">(unmapped)</option>
                        {source.headers.map((header) => (
                          <option key={`${source.id}-${fieldKey}-${header}`} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Clean URL Inventory</h2>
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                onClick={rerunWithManualEdits}
                disabled={loading}
              >
                Re-run with manual edits
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-600">
              Detected URL structure:{" "}
              <span className="font-medium">
                {result.detectedUrlPattern || project.preferredUrlPattern}
              </span>
            </p>
            <DataTable columns={inventoryColumns} data={inventory} />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Content Gap Matrix</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                  onClick={() => {
                    void copyDelimited(matrixRows);
                  }}
                >
                  Copy Table
                </button>
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                  onClick={() => exportRowsAsCsv("content-gap-matrix.csv", matrixRows)}
                >
                  Download CSV
                </button>
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                  onClick={() => exportRowsAsTsv("content-gap-matrix.tsv", matrixRows)}
                >
                  Download TSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Topic</th>
                    {result.matrix.locations.map((location) => (
                      <th key={location} className="px-3 py-2 text-left font-semibold">
                        {location}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.matrix.topics.map((topic) => (
                    <tr key={topic} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-medium">{topic}</td>
                      {result.matrix.locations.map((location) => {
                        const key = `${topic}|||${location}`;
                        const cell = result.matrix.cells[key];
                        const icon = statusToIcon(cell.status);
                        const duplicateIcon = cell.hasPotentialDuplicate ? " 🚩" : "";
                        const urlDisplay = cell.urls[0]?.normalizedUrl ?? "No URL yet";
                        const titleDisplay = cell.urls[0]?.pageTitle ?? "n/a";
                        const publishedDisplay =
                          cell.status === "published"
                            ? parseDateForTooltip(cell.urls[0]?.publishedDate)
                            : null;
                        const sourceDisplay = cell.urls[0]?.sourceName ?? "n/a";
                        const tooltip = [
                          `Status: ${statusToLabel(cell.status)}`,
                          `URL: ${urlDisplay}`,
                          `Title: ${titleDisplay}`,
                          publishedDisplay !== null ? `Published: ${publishedDisplay}` : "",
                          `Source: ${sourceDisplay}`,
                          cell.hasPotentialDuplicate
                            ? `Duplicate: ${cell.duplicateReason}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join("\n");
                        return (
                          <td key={key} className="px-3 py-2">
                            <span title={tooltip} className="cursor-help text-base">
                              {icon}
                              {duplicateIcon}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Legend: ✅ Published · ⏳ In progress · {statusToIcon("needed")} Needed · 🚩 Potential duplicate
            </p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Content Needed</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                  onClick={() => {
                    void copyDelimited(result.contentNeeded);
                  }}
                >
                  Copy List
                </button>
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                  onClick={() => exportRowsAsCsv("content-needed.csv", result.contentNeeded)}
                >
                  Download CSV
                </button>
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                  onClick={() => exportRowsAsTsv("content-needed.tsv", result.contentNeeded)}
                >
                  Download TSV
                </button>
              </div>
            </div>
            <DataTable columns={contentNeededColumns} data={result.contentNeeded} />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Potential Duplicates</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                  onClick={() => {
                    void copyDelimited(result.duplicates);
                  }}
                >
                  Copy List
                </button>
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                  onClick={() => exportRowsAsCsv("potential-duplicates.csv", result.duplicates)}
                >
                  Download CSV
                </button>
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                  onClick={() => exportRowsAsTsv("potential-duplicates.tsv", result.duplicates)}
                >
                  Download TSV
                </button>
              </div>
            </div>
            <DataTable columns={duplicateColumns} data={result.duplicates} />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">All Reports</h2>
              <button
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                onClick={() =>
                  exportWorkbook({
                    filename: `${project.name.replace(/\s+/g, "-").toLowerCase()}-report.xlsx`,
                    matrix: result.matrix,
                    contentNeeded: result.contentNeeded,
                    duplicates: result.duplicates,
                    inventory: inventory,
                    settings: project,
                  })
                }
              >
                Download XLSX Workbook
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Workbook includes matrix, content-needed list, duplicates, clean inventory,
              and project settings. Spreadsheet formulas are escaped to prevent injection.
            </p>
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Add sources and click <span className="font-medium">Generate Content Gap Analysis</span>{" "}
          to create the matrix and reports.
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Quick conventions</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Transactional topic labels are inferred from URL slugs unless provided in CSV.</li>
          <li>Location aliases can be edited by changing inventory rows and re-running.</li>
          <li>Duplicate flags are advisory and require manual review before merge/redirect.</li>
          <li>Hover over matrix icons to view status, dates, and duplicate context.</li>
          <li>Cells can show combined status like ✅ 🚩.</li>
        </ul>
      </section>
    </main>
  );
}
