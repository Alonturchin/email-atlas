import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJsonStringArray } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    ...c,
    tags: parseJsonStringArray(c.tags),
    categories: parseJsonStringArray(c.categories),
    products: parseJsonStringArray(c.products),
    audienceNames: parseJsonStringArray(c.audienceNames),
  });
}

const PatchSchema = z.object({
  favorited: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const raw = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: "invalid body", details: parsed.success ? null : parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const updated = await prisma.campaign.update({
      where: { id },
      data: parsed.data,
      select: { id: true, favorited: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
