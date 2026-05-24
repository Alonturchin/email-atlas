import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseJsonStringArray } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.campaign.findMany({
    select: {
      tags: true,
      categories: true,
      products: true,
      holiday: true,
      season: true,
      sendYear: true,
      sendMonth: true,
    },
  });

  const tagCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();
  const productCount = new Map<string, number>();
  const holidayCount = new Map<string, number>();
  const seasonCount = new Map<string, number>();
  const yearCount = new Map<number, number>();
  const monthCount = new Map<number, number>();

  for (const r of rows) {
    for (const t of parseJsonStringArray(r.tags)) {
      tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    }
    for (const c of parseJsonStringArray(r.categories)) {
      categoryCount.set(c, (categoryCount.get(c) ?? 0) + 1);
    }
    for (const p of parseJsonStringArray(r.products)) {
      productCount.set(p, (productCount.get(p) ?? 0) + 1);
    }
    if (r.holiday) holidayCount.set(r.holiday, (holidayCount.get(r.holiday) ?? 0) + 1);
    if (r.season) seasonCount.set(r.season, (seasonCount.get(r.season) ?? 0) + 1);
    if (r.sendYear > 0) yearCount.set(r.sendYear, (yearCount.get(r.sendYear) ?? 0) + 1);
    if (r.sendMonth > 0)
      monthCount.set(r.sendMonth, (monthCount.get(r.sendMonth) ?? 0) + 1);
  }

  const byCountDesc = <K>(a: [K, number], b: [K, number]) => b[1] - a[1];

  return NextResponse.json({
    tags: [...tagCount.entries()]
      .sort(byCountDesc)
      .map(([tag, count]) => ({ tag, count })),
    categories: [...categoryCount.entries()]
      .sort(byCountDesc)
      .map(([category, count]) => ({ category, count })),
    products: [...productCount.entries()]
      .sort(byCountDesc)
      .map(([product, count]) => ({ product, count })),
    holidays: [...holidayCount.entries()]
      .sort(byCountDesc)
      .map(([holiday, count]) => ({ holiday, count })),
    seasons: [...seasonCount.entries()]
      .sort(byCountDesc)
      .map(([season, count]) => ({ season, count })),
    years: [...yearCount.entries()]
      .sort((a, b) => b[0] - a[0]) // newest year first
      .map(([year, count]) => ({ year, count })),
    months: [...monthCount.entries()]
      .sort((a, b) => a[0] - b[0]) // Jan → Dec
      .map(([month, count]) => ({ month, count })),
  });
}
