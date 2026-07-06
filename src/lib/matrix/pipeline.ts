import type {
  ContentStatus,
  DuplicatePair,
  GapCell,
  GapMatrix,
  NeededContentRow,
  PipelineResult,
  ProjectSettings,
  UrlRecord,
} from "@/lib/types";
import {
  buildUrlFromPattern,
  getPathSegments,
  normalizeUrl,
  slugToLabel,
} from "@/lib/normalize/url";
import { isFaqRow, isFaqTopicName } from "@/lib/classify/faq";
import { strongestStatus } from "@/lib/ingest/parsers";
import { resolvePublishedDate } from "@/lib/publishedDate";

function makeCellKey(topic: string, location: string): string {
  return `${topic}|||${location}`;
}

function inferPattern(urls: UrlRecord[]): string {
  const candidates = new Map<string, number>();

  for (const record of urls) {
    const segments = getPathSegments(record.normalizedUrl);
    if (segments.length < 2) {
      continue;
    }
    const first = segments[0];
    const second = segments[1];
    candidates.set("/{location}/{topic}", (candidates.get("/{location}/{topic}") ?? 0) + 1);
    if (first.includes("service") || second.includes("location")) {
      candidates.set("/{topic}/{location}", (candidates.get("/{topic}/{location}") ?? 0) + 1);
    }
  }

  const sorted = [...candidates.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "/{location}/{topic}";
}

function computeDuplicates(records: UrlRecord[]): DuplicatePair[] {
  const duplicates: DuplicatePair[] = [];
  const byNormalized = new Map<string, UrlRecord[]>();
  const byTopicLocation = new Map<string, UrlRecord[]>();

  for (const record of records) {
    const existing = byNormalized.get(record.normalizedUrl) ?? [];
    existing.push(record);
    byNormalized.set(record.normalizedUrl, existing);

    const topicLocation = makeCellKey(
      (record.topic ?? "").toLowerCase().trim(),
      (record.location ?? "").toLowerCase().trim(),
    );
    if (record.topic && record.location) {
      const matches = byTopicLocation.get(topicLocation) ?? [];
      matches.push(record);
      byTopicLocation.set(topicLocation, matches);
    }
  }

  let counter = 0;
  for (const [url, rows] of byNormalized.entries()) {
    if (rows.length < 2) {
      continue;
    }
    duplicates.push({
      id: `dup-norm-${counter++}`,
      urlA: rows[0].normalizedUrl,
      urlB: rows[1].normalizedUrl,
      reason: "Exact normalized URL duplicate",
      similarityScore: 1,
      sharedTopic: rows[0].topic,
      sharedLocation: rows[0].location,
      reviewStatus: "unreviewed",
      suggestedManualCheck: "Merge or keep one canonical URL.",
    });
    if (url) {
      // no-op; helps avoid lint warning about key usage in loop context
    }
  }

  for (const [key, rows] of byTopicLocation.entries()) {
    if (rows.length < 2) {
      continue;
    }
    const [sharedTopic, sharedLocation] = key.split("|||");
    duplicates.push({
      id: `dup-topic-location-${counter++}`,
      urlA: rows[0].normalizedUrl,
      urlB: rows[1].normalizedUrl,
      reason: "Two URLs target same topic/location cell",
      similarityScore: 0.8,
      sharedTopic: slugToLabel(sharedTopic),
      sharedLocation: slugToLabel(sharedLocation),
      reviewStatus: "unreviewed",
      suggestedManualCheck: "Differentiate intent or merge with redirect.",
    });
  }

  return duplicates;
}

function statusFromRecords(records: UrlRecord[]): ContentStatus {
  return strongestStatus(records.map((record) => record.status), "needed");
}

function toDisplayLabel(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveTopicsAndLocations(
  transactionalRows: UrlRecord[],
  projectSettings: ProjectSettings,
): { topics: string[]; locations: string[] } {
  const topicSet = new Set<string>();
  const locationSet = new Set<string>();

  transactionalRows.forEach((row) => {
    if (row.topic?.trim() && !isFaqRow(row)) {
      topicSet.add(toDisplayLabel(row.topic.trim()));
    }
    if (row.location?.trim()) {
      locationSet.add(toDisplayLabel(row.location.trim()));
    }
  });

  projectSettings.targetLocations.forEach((location) => {
    if (location.trim()) {
      locationSet.add(toDisplayLabel(location.trim()));
    }
  });

  const topics = [...topicSet]
    .filter((topic) => !isFaqTopicName(topic))
    .sort((a, b) => a.localeCompare(b));

  return {
    topics,
    locations: [...locationSet].sort((a, b) => a.localeCompare(b)),
  };
}

function buildGapMatrix(
  transactionalRows: UrlRecord[],
  topics: string[],
  locations: string[],
  duplicates: DuplicatePair[],
): GapMatrix {
  const duplicateLookup = new Set<string>();
  duplicates.forEach((duplicate) => {
    if (duplicate.sharedTopic && duplicate.sharedLocation) {
      duplicateLookup.add(
        makeCellKey(
          duplicate.sharedTopic.toLowerCase(),
          duplicate.sharedLocation.toLowerCase(),
        ),
      );
    }
  });

  const cells: Record<string, GapCell> = {};

  for (const topic of topics) {
    for (const location of locations) {
      const matches = transactionalRows.filter(
        (row) =>
          !isFaqRow(row) &&
          row.topic?.toLowerCase().trim() === topic.toLowerCase() &&
          row.location?.toLowerCase().trim() === location.toLowerCase() &&
          row.includeInAnalysis,
      );

      const key = makeCellKey(topic, location);
      const hasPotentialDuplicate = duplicateLookup.has(
        makeCellKey(topic.toLowerCase(), location.toLowerCase()),
      );
      cells[key] = {
        topic,
        location,
        urls: matches,
        status: matches.length ? statusFromRecords(matches) : "needed",
        hasPotentialDuplicate,
        duplicateReason: hasPotentialDuplicate
          ? "Multiple URLs or duplicate signals for this topic/location."
          : undefined,
      };
    }
  }

  return { topics, locations, cells };
}

function buildContentNeeded(
  matrix: GapMatrix,
  projectSettings: ProjectSettings,
): NeededContentRow[] {
  const needed: NeededContentRow[] = [];
  let counter = 0;

  for (const topic of matrix.topics) {
    for (const location of matrix.locations) {
      const cell = matrix.cells[makeCellKey(topic, location)];
      if (!cell || cell.status !== "needed") {
        continue;
      }

      const proposedUrl = buildUrlFromPattern(
        projectSettings.primaryDomain || "https://example.com",
        projectSettings.preferredUrlPattern || "/{location}/{topic}",
        topic,
        location,
      );

      needed.push({
        id: `needed-${counter++}`,
        topic,
        location,
        proposedTitle: `${location} ${topic}`,
        proposedUrl,
        parentPage: new URL(proposedUrl).origin + "/",
        priority: "high",
        reason: "Missing from approved topic/location coverage grid.",
        status: "needed",
      });
    }
  }

  return needed;
}

export function detectAndFillTopicLocation(rows: UrlRecord[]): UrlRecord[] {
  return rows.map((row) => {
    if (row.topic && row.location) {
      return row;
    }
    const segments = getPathSegments(row.normalizedUrl).map((segment) =>
      slugToLabel(decodeURIComponent(segment)),
    );
    const fallbackLocation = segments[0];
    const fallbackTopic = segments.at(-1);
    return {
      ...row,
      topic: row.topic ?? fallbackTopic,
      location: row.location ?? fallbackLocation,
    };
  });
}

export function buildPipeline(
  allRecords: UrlRecord[],
  projectSettings: ProjectSettings,
): PipelineResult {
  const normalizedMap = new Map<string, UrlRecord[]>();
  for (const row of allRecords) {
    const key = normalizeUrl(row.normalizedUrl) ?? row.normalizedUrl;
    const existing = normalizedMap.get(key) ?? [];
    existing.push(row);
    normalizedMap.set(key, existing);
  }

  const dedupedInventory = [...normalizedMap.entries()].map(([url, rows], index) => {
    const status = strongestStatus(rows.map((row) => row.status), "needed");
    const publishedDate = resolvePublishedDate(
      status,
      rows.find((row) => row.status === "published" && row.publishedDate)?.publishedDate,
    );
    const lastUpdatedDate = rows.find((row) => row.lastUpdatedDate)?.lastUpdatedDate;
    const canonicalUrl = rows.find((row) => row.canonicalUrl)?.canonicalUrl;
    const first = rows[0];
    return {
      ...first,
      id: `inventory-${index}`,
      normalizedUrl: url,
      status,
      publishedDate,
      lastUpdatedDate,
      canonicalUrl,
      sourceName: rows.map((row) => row.sourceName).join(", "),
    };
  });

  const withInferredTaxonomy = detectAndFillTopicLocation(dedupedInventory);
  const transactionalRows = withInferredTaxonomy.filter(
    (row) => row.classification === "transactional",
  );
  const duplicates = computeDuplicates(transactionalRows);
  const { topics, locations } = resolveTopicsAndLocations(
    transactionalRows,
    projectSettings,
  );
  const detectedUrlPattern = inferPattern(transactionalRows);
  const matrix = buildGapMatrix(transactionalRows, topics, locations, duplicates);
  const contentNeeded = buildContentNeeded(matrix, projectSettings);

  return {
    cleanInventory: withInferredTaxonomy,
    duplicates,
    matrix,
    contentNeeded,
    topics,
    locations,
    detectedUrlPattern,
  };
}
