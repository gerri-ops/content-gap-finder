# Content Gap Finder

Content Gap Finder is a Next.js app for content strategists to ingest CSV files, sitemap XML files, sitemap URLs, and pasted URL lists, then produce:

- a clean, deduplicated inventory of transactional pages,
- a topic x location content gap matrix with status icons (`✅`, `⏳`, `🟢`, `🚩`),
- a content-needed recommendation list,
- a potential duplicate report,
- copy/download exports in CSV, TSV, and XLSX workbook format.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- TanStack Table
- Papa Parse (CSV)
- fast-xml-parser (sitemaps)
- SheetJS / `xlsx` (workbook exports)
- Vitest (unit tests)
- Playwright (browser tests)

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run lint` - ESLint checks
- `npm run typecheck` - strict TypeScript checks
- `npm run test` - unit tests (Vitest + coverage)
- `npm run test:e2e` - Playwright e2e tests
- `npm run build` - production build
- `npm run verify` - lint + typecheck + unit tests + production build

## MVP Workflow

1. Enter project settings (domain, geography, URL pattern).
2. Upload one or more CSV files and map each file's columns.
3. Upload one or more sitemap XML files and/or enter sitemap URLs.
4. Paste additional URL lists if needed.
5. Generate analysis.
6. Review and edit inventory rows (status, include flag, classification, date).
7. Re-run analysis with manual edits.
8. Copy/download matrix, content-needed list, duplicate list, or full workbook.

## Security Notes

- File extension and size checks are enforced on client uploads.
- Remote sitemap URL fetches go through `/api/fetch-sitemap`.
- Sitemap fetch route includes SSRF protections:
  - blocks localhost and private/internal IP ranges,
  - limits redirects,
  - request timeout,
  - response size cap.
- Spreadsheet exports sanitize formula-like cell values to reduce injection risk.

## Testing Fixtures

Sample fixtures are under `tests/fixtures/` and used by unit/e2e tests.
