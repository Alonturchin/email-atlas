import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJsonStringArray } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  holiday: z.string().min(1).optional(),
  season: z.enum(["Summer", "Spring", "Winter", "Fall"]).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  minOpenRate: z.coerce.number().min(0).max(1).optional(),
  sort: z.enum(["date", "revenue", "openRate", "clickRate"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  favoritesOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(24),
});

const SORT_COLUMN: Record<
  z.infer<typeof QuerySchema>["sort"],
  keyof Prisma.CampaignOrderByWithRelationInput
> = {
  date: "sendDate",
  revenue: "revenue",
  openRate: "openRate",
  clickRate: "clickRate",
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = QuerySchema.safeParse({
    q: sp.get("q") ?? undefined,
    tags: sp.getAll("tags").length > 0 ? sp.getAll("tags") : undefined,
    categories:
      sp.getAll("categories").length > 0 ? sp.getAll("categories") : undefined,
    products:
      sp.getAll("products").length > 0 ? sp.getAll("products") : undefined,
    holiday: sp.get("holiday") ?? undefined,
    season: sp.get("season") ?? undefined,
    year: sp.get("year") ?? undefined,
    month: sp.get("month") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    minOpenRate: sp.get("minOpenRate") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    order: sp.get("order") ?? undefined,
    favoritesOnly: sp.get("favoritesOnly") ?? undefined,
    page: sp.get("page") ?? undefined,
    pageSize: sp.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const q = parsed.data;

  const where: Prisma.CampaignWhereInput = {};
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { subject: { contains: q.q, mode: "insensitive" } },
    ];
  }
  if (q.holiday) where.holiday = q.holiday;
  if (q.season) where.season = q.season;
  if (q.year !== undefined) where.sendYear = q.year;
  if (q.month !== undefined) where.sendMonth = q.month;
  if (q.from || q.to) {
    where.sendDate = {};
    if (q.from) where.sendDate.gte = new Date(q.from);
    if (q.to) where.sendDate.lte = new Date(q.to);
  }
  if (q.minOpenRate !== undefined) where.openRate = { gte: q.minOpenRate };
  if (q.favoritesOnly) where.favorited = true;
  // Multi-tag and multi-category filters AND together (must have ALL selected).
  // Stored as JSON.stringify(["a","b"]) — match exact-quoted to avoid substring
  // collisions (e.g. "Sale" vs "Flash Sale").
  const andClauses: Prisma.CampaignWhereInput[] = [];
  if (q.tags && q.tags.length > 0) {
    for (const t of q.tags) andClauses.push({ tags: { contains: `"${t}"` } });
  }
  if (q.categories && q.categories.length > 0) {
    for (const c of q.categories)
      andClauses.push({ categories: { contains: `"${c}"` } });
  }
  if (q.products && q.products.length > 0) {
    for (const p of q.products)
      andClauses.push({ products: { contains: `"${p}"` } });
  }
  if (andClauses.length > 0) where.AND = andClauses;

  const orderBy: Prisma.CampaignOrderByWithRelationInput = {
    [SORT_COLUMN[q.sort]]: q.order,
  };
  const skip = (q.page - 1) * q.pageSize;

  const [items, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy,
      skip,
      take: q.pageSize,
      // Omit templateHtml — too large for list payloads. Fetched on detail.
      select: {
        id: true,
        name: true,
        subject: true,
        previewText: true,
        sendDate: true,
        sendYear: true,
        sendMonth: true,
        status: true,
        thumbnailUrl: true,
        tags: true,
        categories: true,
        products: true,
        holiday: true,
        season: true,
        audienceNames: true,
        recipients: true,
        openRate: true,
        clickRate: true,
        ctor: true,
        conversionRate: true,
        revenue: true,
        aov: true,
        unsubscribeRate: true,
        favorited: true,
        lastSyncedAt: true,
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  const itemsOut = items.map((c) => ({
    ...c,
    tags: parseJsonStringArray(c.tags),
    categories: parseJsonStringArray(c.categories),
    products: parseJsonStringArray(c.products),
    audienceNames: parseJsonStringArray(c.audienceNames),
  }));

  return NextResponse.json({
    items: itemsOut,
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.ceil(total / q.pageSize),
  });
}
