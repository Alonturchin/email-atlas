/**
 * Targeted backfill: load the EIKONA flow overlay and update only the
 * matched draft Campaign rows in Postgres. Much faster than a full sync
 * (~30 seconds vs 22 minutes) and proves the overlay code works against
 * real data.
 *
 *   docker compose exec web pnpm tsx scripts/backfill-eikona-flows.ts
 */

import { klaviyoGet } from "../lib/klaviyo/client";
import { prisma } from "../lib/db";
import {
  loadEikonaOverlay,
  normalizeCampaignName,
} from "../lib/klaviyo/eikona-flows";
import { MetricsListResponse } from "../lib/klaviyo/types";

async function main() {
  const t0 = Date.now();

  console.log("→ Looking up Placed Order metric…");
  const metrics = await klaviyoGet("/api/metrics/", MetricsListResponse);
  const placedOrder = metrics.data.find(
    (m) => m.attributes.name === "Placed Order",
  );
  if (!placedOrder) throw new Error("Placed Order metric not found");
  console.log(`  ✓ ${placedOrder.id}`);

  console.log("→ Loading EIKONA flow overlay (this fetches ~3 flow pages + 2-3 report batches)…");
  const overlay = await loadEikonaOverlay(placedOrder.id);
  console.log(
    `  ✓ ${overlay.flowsFound} EIKONA flows, ${overlay.metricsFound} with metrics, ${overlay.metricsByNormalizedName.size} unique normalized names`,
  );

  console.log("→ Loading draft campaigns from DB…");
  const drafts = await prisma.campaign.findMany({
    where: { status: { in: ["Draft", "draft"] } },
    select: { id: true, name: true, recipients: true, openRate: true },
  });
  console.log(`  ✓ ${drafts.length} drafts`);

  console.log("→ Applying overlays…");
  let updated = 0;
  let skipped = 0;
  const samples: { name: string; recipients: number; openRate: number; revenue: number }[] = [];

  for (const c of drafts) {
    const flow = overlay.metricsByNormalizedName.get(
      normalizeCampaignName(c.name),
    );
    if (!flow) {
      skipped += 1;
      continue;
    }
    await prisma.campaign.update({
      where: { id: c.id },
      data: {
        recipients: flow.recipients,
        openRate: flow.openRate,
        clickRate: flow.clickRate,
        ctor: flow.ctor,
        conversionRate: flow.conversionRate,
        revenue: flow.revenue,
        aov: flow.aov,
        unsubscribeRate: flow.unsubscribeRate,
        lastSyncedAt: new Date(),
      },
    });
    updated += 1;
    if (samples.length < 5 && flow.recipients > 0) {
      samples.push({
        name: c.name,
        recipients: flow.recipients,
        openRate: flow.openRate,
        revenue: flow.revenue,
      });
    }
  }

  console.log(`\n📊 Result: ${updated} updated, ${skipped} not matched`);
  console.log(`   elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  if (samples.length > 0) {
    console.log("Sample updated rows:");
    for (const s of samples) {
      console.log(
        `  ${s.recipients.toLocaleString().padStart(7)} recipients · open ${(s.openRate * 100).toFixed(1).padStart(5)}% · rev $${s.revenue.toFixed(0).padStart(8)} · ${s.name.slice(0, 70)}`,
      );
    }
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("✗ backfill failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
