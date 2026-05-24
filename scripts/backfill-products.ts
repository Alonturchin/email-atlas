/**
 * Extract product slugs from every campaign's templateHtml and store them on
 * the row. No Klaviyo refetch — operates entirely on local data.
 *
 *   docker compose exec web pnpm tsx scripts/backfill-products.ts
 */

import { prisma } from "../lib/db";
import { extractProductSlugs } from "../lib/extract-products";

async function main() {
  const t0 = Date.now();
  const rows = await prisma.campaign.findMany({
    select: { id: true, templateHtml: true },
  });
  console.log(`→ Scanning ${rows.length} campaigns`);

  let withProducts = 0;
  let totalSlugs = 0;
  const slugCount = new Map<string, number>();

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((r) => {
        const slugs = extractProductSlugs(r.templateHtml);
        if (slugs.length > 0) {
          withProducts += 1;
          totalSlugs += slugs.length;
          for (const s of slugs) slugCount.set(s, (slugCount.get(s) ?? 0) + 1);
        }
        return prisma.campaign.update({
          where: { id: r.id },
          data: { products: JSON.stringify(slugs) },
        });
      }),
    );
    process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ${rows.length}/${rows.length}    `);

  console.log(`\n📊 Result:`);
  console.log(
    `  campaigns with ≥1 product link: ${withProducts} (${pct(withProducts, rows.length)})`,
  );
  console.log(`  unique product slugs found:     ${slugCount.size}`);
  console.log(
    `  avg slugs per matched campaign: ${(totalSlugs / Math.max(withProducts, 1)).toFixed(1)}`,
  );
  console.log(`  elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  console.log("Top 15 product slugs by mention count:");
  const top = [...slugCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  for (const [slug, count] of top) {
    console.log(`  ${String(count).padStart(4)}  ${slug}`);
  }

  await prisma.$disconnect();
}

function pct(n: number, total: number): string {
  return `${((n / total) * 100).toFixed(0)}%`;
}

main().catch(async (err) => {
  console.error("✗ backfill failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
