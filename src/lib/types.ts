export type ContentStatus = "published" | "in_progress" | "needed";

export type DuplicateReviewStatus = "unreviewed" | "approved" | "resolved";

export type InputSourceType = "csv" | "sitemap_xml" | "sitemap_url" | "url_list";

export type GeographicTargetType = "state" | "county" | "city";

export interface ProjectSettings {
  name: string;
  primaryDomain: string;
  geographicTargetType: GeographicTargetType;
  targetLocations: string[];
  preferredUrlPattern: string;
}

export interface CsvFieldMapping {
  url?: string;
  pageTitle?: string;
  topic?: string;
  location?: string;
  status?: string;
  publishedDate?: string;
  contentType?: string;
  canonicalUrl?: string;
  lastUpdatedDate?: string;
}

export interface CsvSourceFile {
  id: string;
  name: string;
  headers: string[];
  rawText: string;
  mapping: CsvFieldMapping;
}

export interface SitemapSourceFile {
  id: string;
  name: string;
  rawText: string;
}

export interface SitemapUrlSource {
  id: string;
  url: string;
}

export interface UrlRecord {
  id: string;
  originalUrl: string;
  normalizedUrl: string;
  pageTitle?: string;
  topic?: string;
  location?: string;
  status: ContentStatus;
  publishedDate?: string;
  contentType?: string;
  canonicalUrl?: string;
  lastUpdatedDate?: string;
  sourceType: InputSourceType;
  sourceName: string;
  lastmod?: string;
  classification: "transactional" | "non_transactional";
  includeInAnalysis: boolean;
}

export interface DuplicatePair {
  id: string;
  urlA: string;
  urlB: string;
  reason: string;
  similarityScore: number;
  sharedTopic?: string;
  sharedLocation?: string;
  reviewStatus: DuplicateReviewStatus;
  suggestedManualCheck: string;
}

export interface GapCell {
  topic: string;
  location: string;
  urls: UrlRecord[];
  status: ContentStatus;
  hasPotentialDuplicate: boolean;
  duplicateReason?: string;
}

export interface GapMatrix {
  topics: string[];
  locations: string[];
  cells: Record<string, GapCell>;
}

export interface NeededContentRow {
  id: string;
  topic: string;
  location: string;
  proposedTitle: string;
  proposedUrl: string;
  parentPage: string;
  priority: "high" | "medium" | "low";
  reason: string;
  status: "needed";
}

export interface PipelineResult {
  cleanInventory: UrlRecord[];
  duplicates: DuplicatePair[];
  matrix: GapMatrix;
  contentNeeded: NeededContentRow[];
  topics: string[];
  locations: string[];
  detectedUrlPattern: string;
}
