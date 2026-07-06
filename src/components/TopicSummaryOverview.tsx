"use client";

import { statusToIcon, statusToLabel } from "@/components/statusIcon";
import {
  exportRowsAsCsv,
  exportRowsAsTsv,
  exportCoverageWorkbook,
} from "@/lib/export/tableExport";
import {
  buildCoverageDetailRows,
  buildCoverageSummaryRows,
  computeMatrixSummary,
  coverageExportFilename,
  type CoverageStatusFilter,
} from "@/lib/matrix/summary";
import type { ContentStatus, GapMatrix } from "@/lib/types";

interface TopicSummaryOverviewProps {
  matrix: GapMatrix;
  projectName: string;
}

function ExportButtons({
  label,
  statusFilter,
  projectName,
  matrix,
  includeSummary,
}: {
  label: string;
  statusFilter: CoverageStatusFilter;
  projectName: string;
  matrix: GapMatrix;
  includeSummary?: boolean;
}) {
  const summary = computeMatrixSummary(matrix);
  const summaryRows = buildCoverageSummaryRows(summary);
  const detailRows = buildCoverageDetailRows(matrix, statusFilter);

  function handleCsv() {
    if (includeSummary) {
      exportRowsAsCsv(
        coverageExportFilename(projectName, "all", "csv"),
        [...summaryRows, ...detailRows],
      );
      return;
    }
    exportRowsAsCsv(
      coverageExportFilename(projectName, statusFilter, "csv"),
      detailRows,
    );
  }

  function handleTsv() {
    if (includeSummary) {
      exportRowsAsTsv(
        coverageExportFilename(projectName, "all", "tsv"),
        [...summaryRows, ...detailRows],
      );
      return;
    }
    exportRowsAsTsv(
      coverageExportFilename(projectName, statusFilter, "tsv"),
      detailRows,
    );
  }

  function handleXlsx() {
    exportCoverageWorkbook({
      filename: coverageExportFilename(projectName, statusFilter, "xlsx"),
      matrix,
      statusFilter,
      includeSummary: includeSummary ?? statusFilter === "all",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <button
        type="button"
        className="rounded border border-slate-300 px-2 py-1 text-xs"
        onClick={handleCsv}
      >
        CSV
      </button>
      <button
        type="button"
        className="rounded border border-slate-300 px-2 py-1 text-xs"
        onClick={handleTsv}
      >
        TSV
      </button>
      <button
        type="button"
        className="rounded border border-slate-300 px-2 py-1 text-xs"
        onClick={handleXlsx}
      >
        XLSX
      </button>
    </div>
  );
}

export function TopicSummaryOverview({ matrix, projectName }: TopicSummaryOverviewProps) {
  const summary = computeMatrixSummary(matrix);

  const statCards: Array<{
    status: ContentStatus;
    count: number;
    label: string;
  }> = [
    {
      status: "published",
      count: summary.published,
      label: statusToLabel("published"),
    },
    {
      status: "in_progress",
      count: summary.inProgress,
      label: statusToLabel("in_progress"),
    },
    {
      status: "needed",
      count: summary.needed,
      label: statusToLabel("needed"),
    },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Coverage Summary</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Counts reflect topic x location cells in the gap matrix (
            {summary.uniqueTopics} topics x {summary.uniqueLocations} locations ={" "}
            {summary.totalCells} cells). Each cell is one planned page for a service in a
            market, not a unique topic name alone.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.status}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <p className="text-sm text-slate-600">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">
              {statusToIcon(card.status)} {card.count}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {summary.totalCells > 0
                ? `${Math.round((card.count / summary.totalCells) * 1000) / 10}% of grid`
                : "0% of grid"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-800">Export coverage data</h3>
        <p className="mt-1 text-xs text-slate-600">
          Summary exports include count metrics; detail exports list each topic x location
          cell with status, URL, and duplicate flags.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <ExportButtons
            label="All statuses (summary + detail)"
            statusFilter="all"
            projectName={projectName}
            matrix={matrix}
            includeSummary
          />
          <ExportButtons
            label={`${statusToLabel("published")} only`}
            statusFilter="published"
            projectName={projectName}
            matrix={matrix}
          />
          <ExportButtons
            label={`${statusToLabel("in_progress")} only`}
            statusFilter="in_progress"
            projectName={projectName}
            matrix={matrix}
          />
          <ExportButtons
            label={`${statusToLabel("needed")} only`}
            statusFilter="needed"
            projectName={projectName}
            matrix={matrix}
          />
        </div>
      </div>
    </section>
  );
}
