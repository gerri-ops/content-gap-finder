import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchSitemapSafely } from "@/lib/security/sitemapFetch";

export const runtime = "nodejs";

const requestSchema = z.object({
  url: z.string().url(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid sitemap URL payload." },
        { status: 400 },
      );
    }

    const xml = await fetchSitemapSafely(parsed.data.url);
    return NextResponse.json({ xml });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected sitemap fetch error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
