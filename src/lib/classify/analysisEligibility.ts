import { isFaqRow } from "@/lib/classify/faq";
import type { UrlRecord } from "@/lib/types";

/** Transactional pages the user has not opted out of via Include. */
export function isTransactionalForAnalysis(row: UrlRecord): boolean {
  return row.classification === "transactional" && row.includeInAnalysis;
}

/** Rows that may populate the gap matrix, coverage summary, and content-needed list. */
export function isMatrixEligible(row: UrlRecord): boolean {
  return isTransactionalForAnalysis(row) && !isFaqRow(row);
}
