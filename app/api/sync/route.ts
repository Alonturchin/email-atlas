import { NextResponse, type NextRequest } from "next/server";
import { runSync } from "@/lib/klaviyo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow long runs in dev; a real sync can take a few minutes.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const expected = process.env.SYNC_TOKEN;
  const provided = req.headers.get("x-sync-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runSync();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[sync] failed:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
