import Papa from "papaparse";
import { XMLParser } from "fast-xml-parser";

import type {
  ContentStatus,
  CsvFieldMapping,
  CsvSourceFile,
  UrlRecord,
} from "@/lib/types";
import { normalizeUrl } from "@/lib/normalize/url";
import { isTransactionalPage } from "@/lib/classify/transactional";
import { resolvePublishedDate } from "@/lib/publishedDate";

function parseStatus(value?: string): ContentStatus {
  const lower = value?.toLowerCase().trim() ?? "";
  if (lower.includes("publish") || lower === "live") {
    return "published";
  }
  if (lower.includes("progress") || lower.includes("draft")) {
    return "in_progress";
  }
  return "needed";
}

export function strongestStatus(
  statuses: ContentStatus[],
  fallback: ContentStatus = "needed",
): ContentStatus {
  if (statuses.includes("published")) {
    return "published";
  }
  if (statuses.includes("in_progress")) {
    return "in_progress";
  }
  return fallback;
}

function inferTopicFromUrl(normalizedUrl: string): string | undefined {
  const segments = new URL(normalizedUrl).pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).toLowerCase());
  const topicSegment = segments.at(-1);
  if (!topicSegment) {
    return undefined;
  }
  return topicSegment.replace(/[-_]+/g, " ");
}

function inferLocationFromUrl(normalizedUrl: string): string | undefined {
  const segments = new URL(normalizedUrl).pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).toLowerCase());
  if (segments.length < 2) {
    return undefined;
  }
  return segments[0].replace(/[-_]+/g, " ");
}

function createRecordBase(
  sourceType: UrlRecord["sourceType"],
  sourceName: string,
): Omit<UrlRecord, "id" | "originalUrl" | "normalizedUrl" | "status"> {
  return {
    pageTitle: undefined,
    topic: undefined,
    location: undefined,
    publishedDate: undefined,
    contentType: undefined,
    canonicalUrl: undefined,
    lastUpdatedDate: undefined,
    sourceType,
    sourceName,
    lastmod: undefined,
    classification: "non_transactional",
    includeInAnalysis: true,
  };
}

export function parseCsvSource(file: CsvSourceFile): UrlRecord[] {
  const rows = Papa.parse<Record<string, string>>(file.rawText, {
    header: true,
    skipEmptyLines: true,
  }).data;

  return rows
    .map((row, index) => {
      const mapping: CsvFieldMapping = file.mapping;
      const rawUrl = mapping.url ? row[mapping.url] : undefined;
      const normalizedUrl = rawUrl ? normalizeUrl(rawUrl) : null;
      if (!rawUrl || !normalizedUrl) {
        return null;
      }

      const topic =
        (mapping.topic ? row[mapping.topic] : undefined)?.trim() ||
        inferTopicFromUrl(normalizedUrl);
      const location =
        (mapping.location ? row[mapping.location] : undefined)?.trim() ||
        inferLocationFromUrl(normalizedUrl);

      const base = createRecordBase("csv", file.name);
      const status = parseStatus(mapping.status ? row[mapping.status] : undefined);
      const record: UrlRecord = {
        ...base,
        id: `${file.id}-row-${index}`,
        originalUrl: rawUrl,
        normalizedUrl,
        pageTitle: mapping.pageTitle ? row[mapping.pageTitle]?.trim() : undefined,
        topic,
        location,
        status,
        publishedDate: resolvePublishedDate(
          status,
          mapping.publishedDate ? row[mapping.publishedDate]?.trim() : undefined,
        ),
        contentType: mapping.contentType
          ? row[mapping.contentType]?.trim()
          : undefined,
        canonicalUrl: mapping.canonicalUrl
          ? row[mapping.canonicalUrl]?.trim()
          : undefined,
        lastUpdatedDate: mapping.lastUpdatedDate
          ? row[mapping.lastUpdatedDate]?.trim()
          : undefined,
      };
      record.classification = isTransactionalPage(
        record.normalizedUrl,
        record.contentType,
      )
        ? "transactional"
        : "non_transactional";
      return record;
    })
    .filter((record): record is UrlRecord => Boolean(record));
}

export function parseSitemapXml(
  xml: string,
  sourceName: string,
  idPrefix: string,
  sourceType: UrlRecord["sourceType"] = "sitemap_xml",
): UrlRecord[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  });
  const parsed = parser.parse(xml) as {
    urlset?: { url?: Array<{ loc?: string; lastmod?: string }> };
  };

  const entries = parsed.urlset?.url ?? [];

  return entries
    .map((entry, index) => {
      const normalizedUrl = entry.loc ? normalizeUrl(entry.loc) : null;
      if (!entry.loc || !normalizedUrl) {
        return null;
      }

      const base = createRecordBase(sourceType, sourceName);
      const record: UrlRecord = {
        ...base,
        id: `${idPrefix}-sitemap-${index}`,
        originalUrl: entry.loc,
        normalizedUrl,
        status: "published",
        topic: inferTopicFromUrl(normalizedUrl),
        location: inferLocationFromUrl(normalizedUrl),
        lastmod: entry.lastmod,
      };
      record.classification = isTransactionalPage(record.normalizedUrl)
        ? "transactional"
        : "non_transactional";
      return record;
    })
    .filter((record): record is UrlRecord => Boolean(record));
}

export function parseUrlList(text: string, sourceName = "Pasted URL List"): UrlRecord[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const normalizedUrl = normalizeUrl(line);
      if (!normalizedUrl) {
        return null;
      }
      const base = createRecordBase("url_list", sourceName);
      const record: UrlRecord = {
        ...base,
        id: `url-list-${index}`,
        originalUrl: line,
        normalizedUrl,
        status: "published",
        topic: inferTopicFromUrl(normalizedUrl),
        location: inferLocationFromUrl(normalizedUrl),
      };
      record.classification = isTransactionalPage(record.normalizedUrl)
        ? "transactional"
        : "non_transactional";
      return record;
    })
    .filter((record): record is UrlRecord => Boolean(record));
}

export function detectCsvMapping(headers: string[]): CsvFieldMapping {
  const mapping: CsvFieldMapping = {};
  const headerLookup = headers.map((header) => header.trim());

  function find(...needles: string[]): string | undefined {
    return headerLookup.find((header) => {
      const lower = header.toLowerCase();
      return needles.some((needle) => lower.includes(needle));
    });
  }

  mapping.url = find("url", "address", "page");
  mapping.pageTitle = find("title", "page title");
  mapping.topic = find("topic", "service", "practice");
  mapping.location = find("location", "city", "state", "county");
  mapping.status = find("status", "state");
  mapping.publishedDate = find("published", "date");
  mapping.contentType = find("content type", "type");
  mapping.canonicalUrl = find("canonical");
  mapping.lastUpdatedDate = find("updated", "last modified");

  return mapping;
}
