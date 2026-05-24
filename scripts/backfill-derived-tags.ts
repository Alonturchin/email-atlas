/**
 * Re-derive season / holiday / categories / sendYear / sendMonth from the
 * existing campaign rows. No Klaviyo refetch — operates entirely on local
 * data, so it's a few seconds even for ~2k rows.
 *
 *   docker compose exec web pnpm tsx scripts/backfill-derived-tags.ts
 */

import { prisma } from "../lib/db";
import { deriveTagsFromName } from "../lib/derive-tags";

async function main() {
  const t0 = Date.now();
  const rows = await prisma.campaign.findMany({
    select: { id: true, name: true, sendDate: true },
  });
  console.log(`→ Re-deriving for ${rows.length} campaigns`);

  let updated = 0;
  let seasonHits = 0;
  let holidayHits = 0;
  let categoryHits = 0;

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((r) => {
        const d = deriveTagsFromName(r.name);
        if (d.season) seasonHits += 1;
        if (d.holiday) holidayHits += 1;
        if (d.categories.length > 0) categoryHits += 1;
        updated += 1;
        return prisma.campaign.update({
          where: { id: r.id },
          data: {
            season: d.season,
            holiday: d.holiday,
            categories: JSON.stringify(d.categories),
            sendYear: r.sendDate.getUTCFullYear(),
            sendMonth: r.sendDate.getUTCMonth() + 1,
          },
        });
      }),
    );
    process.stdout.write(`  ${i + batch.length}/${rows.length}\r`);
  }
  console.log(`  ${updated}/${rows.length}    `);

  console.log(`\n📊 Coverage:`);
  console.log(`  with season:     ${seasonHits} (${pct(seasonHits, rows.length)})`);
  console.log(`  with holiday:    ${holidayHits} (${pct(holidayHits, rows.length)})`);
  console.log(`  with categories: ${categoryHits} (${pct(categoryHits, rows.length)})`);
  console.log(`  elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

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
