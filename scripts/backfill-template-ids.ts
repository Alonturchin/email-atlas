/**
 * Backfill `templateId` on existing Campaign rows. We already fetched message
 * data during the original sync but discarded the template ID; this script
 * re-walks /api/campaigns/ + /api/campaign-messages/{id}/ to populate it.
 *
 * Runs at ~the same speed as the message-fetch pass of a full sync (~5 min
 * with concurrency 6) but skips templates, metrics, and DB upserts of other
 * fields — much faster than re-running the whole sync.
 *
 *   docker compose exec web pnpm tsx scripts/backfill-template-ids.ts
 */

import { klaviyoGet } from "../lib/klaviyo/client";
import {
  CampaignMessageResponse,
  CampaignsListResponse,
} from "../lib/klaviyo/types";
import { prisma } from "../lib/db";

interface MessageRef {
  campaignId: string;
  messageId: string;
}

async function main() {
  const t0 = Date.now();

  console.log("→ Listing campaigns to map campaign → message IDs…");
  const refs: MessageRef[] = [];
  let next: string | null = null;
  let pageCount = 0;
  do {
    const page = await klaviyoGet(
      next ?? "/api/campaigns/",
      CampaignsListResponse,
      next
        ? undefined
        : {
            filter: "equals(messages.channel,'email')",
            include: "campaign-messages,tags",
          },
    );
    for (const c of page.data) {
      const msgRef = c.relationships?.["campaign-messages"]?.data?.[0];
      if (msgRef) refs.push({ campaignId: c.id, messageId: msgRef.id });
    }
    next = page.links?.next ?? null;
    pageCount++;
  } while (next);
  console.log(`  ✓ ${refs.length} campaigns across ${pageCount} page(s)`);

  // Skip campaigns that already have a templateId (idempotent re-runs).
  const existing = await prisma.campaign.findMany({
    where: { templateId: { not: null } },
    select: { id: true },
  });
  const skipIds = new Set(existing.map((r) => r.id));
  const toFetch = refs.filter((r) => !skipIds.has(r.campaignId));
  console.log(
    `  ${skipIds.size} already populated, ${toFetch.length} to fetch`,
  );

  console.log("→ Fetching messages (concurrency 6)…");
  let done = 0;
  let updated = 0;
  let missing = 0;
  let errors = 0;
  const CONCURRENCY = 6;
  let cursor = 0;

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= toFetch.length) return;
        const { campaignId, messageId } = toFetch[i];
        try {
          const msg = await klaviyoGet(
            `/api/campaign-messages/${messageId}/`,
            CampaignMessageResponse,
          );
          const templateId =
            msg.data.relationships?.template?.data?.id ?? null;
          if (templateId) {
            await prisma.campaign.update({
              where: { id: campaignId },
              data: { templateId },
            });
            updated++;
          } else {
            missing++;
          }
        } catch (e) {
          errors++;
          if (errors < 5)
            console.error(`  ! ${campaignId}: ${(e as Error).message}`);
        }
        done++;
        if (done % 50 === 0) {
          process.stdout.write(`  ${done}/${toFetch.length}\r`);
        }
      }
    }),
  );

  console.log(`  ${done}/${toFetch.length}    `);
  console.log(`\n📊 Result:`);
  console.log(`  updated:               ${updated}`);
  console.log(`  message had no template: ${missing}`);
  console.log(`  errors:                ${errors}`);
  console.log(`  elapsed:               ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("✗ backfill-template-ids failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
