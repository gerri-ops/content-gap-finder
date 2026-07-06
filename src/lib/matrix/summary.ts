import { statusToLabel } from "@/components/statusIcon";
import { formatPublishedDateForDisplay } from "@/lib/publishedDate";
import type { ContentStatus, GapCell, GapMatrix } from "@/lib/types";

export type CoverageStatusFilter = ContentStatus | "all";

export interface MatrixSummary {
  /** Topic × location cells with published status. */
  published: number;
  /** Topic × location cells with in-progress status. */
  inProgress: number;
  /** Topic × location cells with needed (gap) status. */
  needed: number;
  /** Total topic × location cells in the coverage grid. */
  totalCells: number;
  /** Distinct service/topic rows in the matrix. */
  uniqueTopics: number;
  /** Distinct geographic columns in the matrix. */
  uniqueLocations: number;
}

export interface CoverageSummaryRow {
  metric: string;
  count: number;
  shareOfGrid: string;
}

export interface CoverageDetailRow {
  topic: string;
  location: string;
  status: string;
  url: string;
  pageTitle: string;
  publishedDate: string;
  hasPotentialDuplicate: string;
  duplicateReason: string;
}

function makeCellKey(topic: string, location: string): string {
  return `${topic}|||${location}`;
}

export function iterMatrixCells(matrix: GapMatrix): GapCell[] {
  const cells: GapCell[] = [];
  for (const topic of matrix.topics) {
    for (const location of matrix.locations) {
      const cell = matrix.cells[makeCellKey(topic, location)];
      if (cell) {
        cells.push(cell);
      }
    }
  }
  return cells;
}

export function computeMatrixSummary(matrix: GapMatrix): MatrixSummary {
  const cells = iterMatrixCells(matrix);
  let published = 0;
  let inProgress = 0;
  let needed = 0;

  for (const cell of cells) {
    switch (cell.status) {
      case "published":
        published += 1;
        break;
      case "in_progress":
        inProgress += 1;
        break;
      case "needed":
      default:
        needed += 1;
        break;
    }
  }

  return {
    published,
    inProgress,
    needed,
    totalCells: cells.length,
    uniqueTopics: matrix.topics.length,
    uniqueLocations: matrix.locations.length,
  };
}

export function filterCellsByStatus(
  cells: GapCell[],
  statusFilter: CoverageStatusFilter,
): GapCell[] {
  if (statusFilter === "all") {
    return cells;
  }
  return cells.filter((cell) => cell.status === statusFilter);
}

function formatShare(count: number, total: number): string {
  if (total === 0) {
    return "0%";
  }
  return `${Math.round((count / total) * 1000) / 10}%`;
}

export function buildCoverageSummaryRows(summary: MatrixSummary): CoverageSummaryRow[] {
  const { totalCells } = summary;
  return [
    {
      metric: "Published (topic × location cells)",
      count: summary.published,
      shareOfGrid: formatShare(summary.published, totalCells),
    },
    {
      metric: "In progress (topic × location cells)",
      count: summary.inProgress,
      shareOfGrid: formatShare(summary.inProgress, totalCells),
    },
    {
      metric: "Needed (topic × location cells)",
      count: summary.needed,
      shareOfGrid: formatShare(summary.needed, totalCells),
    },
    {
      metric: "Total coverage cells",
      count: summary.totalCells,
      shareOfGrid: "100%",
    },
    {
      metric: "Unique topics (matrix rows)",
      count: summary.uniqueTopics,
      shareOfGrid: "",
    },
    {
      metric: "Unique locations (matrix columns)",
      count: summary.uniqueLocations,
      shareOfGrid: "",
    },
  ];
}

export function buildCoverageDetailRows(
  matrix: GapMatrix,
  statusFilter: CoverageStatusFilter = "all",
): CoverageDetailRow[] {
  const cells = filterCellsByStatus(iterMatrixCells(matrix), statusFilter);
  return cells.map((cell) => {
    const primaryUrl = cell.urls[0];
    return {
      topic: cell.topic,
      location: cell.location,
      status: statusToLabel(cell.status),
      url: primaryUrl?.normalizedUrl ?? "",
      pageTitle: primaryUrl?.pageTitle ?? "",
      publishedDate: formatPublishedDateForDisplay(
        cell.status,
        primaryUrl?.publishedDate,
      ),
      hasPotentialDuplicate: cell.hasPotentialDuplicate ? "Yes" : "No",
      duplicateReason: cell.duplicateReason ?? "",
    };
  });
}

export function coverageExportFilename(
  projectName: string,
  statusFilter: CoverageStatusFilter,
  extension: string,
): string {
  const slug = projectName.replace(/\s+/g, "-").toLowerCase() || "coverage";
  const statusSlug =
    statusFilter === "all"
      ? "all"
      : statusFilter === "in_progress"
        ? "in-progress"
        : statusFilter;
  return `${slug}-coverage-${statusSlug}.${extension}`;
}
