/**
 * Dry-run the campaign↔flow matching algorithm.
 * No DB writes — just reports match rate so we can validate the heuristic
 * before wiring it into the real sync.
 *
 *   docker compose exec web pnpm tsx scripts/probe-flow-match.ts
 */

import { z } from "zod";
import { klaviyoGet } from "../lib/klaviyo/client";
import { prisma } from "../lib/db";

const FlowList = z.object({
  data: z.array(
    z.object({
      type: z.literal("flow"),
      id: z.string(),
      attributes: z
        .object({
          name: z.string().nullable().optional(),
          status: z.string().nullable().optional(),
        })
        .passthrough(),
    }),
  ),
  links: z
    .object({ next: z.string().nullable().optional() })
    .passthrough()
    .optional(),
});

// Strip "(EIKONA) Campaign Experiment - " or "(EIKONA internal test) Campaign Experiment - " prefix,
// and " - <hex>" suffix (the tooling-generated hash at the end of each flow name).
const FLOW_PREFIX_RE = /^\(EIKONA(?:\s+internal\s+test)?\)\s*Campaign\s+Experiment\s*-\s*/i;
const FLOW_HASH_SUFFIX_RE = /\s*-\s*[a-f0-9]{6,}\s*$/i;
const CAMPAIGN_PREFIX_RE = /^\[SCHEDULED\]\s*/i;

function normalizeFlow(name: string): string {
  return name
    .replace(FLOW_PREFIX_RE, "")
    .replace(FLOW_HASH_SUFFIX_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function normalizeCampaign(name: string): string {
  return name
    .replace(CAMPAIGN_PREFIX_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function main() {
  console.log("→ Listing flows…");
  const flowMatches: { id: string; name: string; normalized: string; status: string | null }[] = [];
  let next: string | null = null;
  do {
    const page = await klaviyoGet(next ?? "/api/flows/", FlowList);
    for (const f of page.data) {
      const name = f.attributes.name ?? "";
      if (FLOW_PREFIX_RE.test(name)) {
        flowMatches.push({
          id: f.id,
          name,
          normalized: normalizeFlow(name),
          status: f.attributes.status ?? null,
        });
      }
    }
    next = page.links?.next ?? null;
  } while (next);
  console.log(`  ✓ ${flowMatches.length} EIKONA flows`);

  // Pull draft campaigns from DB
  const drafts = await prisma.campaign.findMany({
    where: { status: { in: ["Draft", "draft"] } },
    select: { id: true, name: true, recipients: true, openRate: true },
  });
  console.log(`  ✓ ${drafts.length} draft campaigns in DB`);

  // Build map: normalized name → flow
  const flowByNormalized = new Map<string, (typeof flowMatches)[number]>();
  for (const f of flowMatches) {
    // If duplicates exist, keep the live one preferentially
    const existing = flowByNormalized.get(f.normalized);
    if (!existing || (f.status === "live" && existing.status !== "live")) {
      flowByNormalized.set(f.normalized, f);
    }
  }

  // Try to match each draft
  let matched = 0;
  const unmatchedDrafts: string[] = [];
  const matchedSamples: { campaign: string; flow: string; flowId: string }[] = [];
  for (const c of drafts) {
    const normalized = normalizeCampaign(c.name);
    const flow = flowByNormalized.get(normalized);
    if (flow) {
      matched += 1;
      if (matchedSamples.length < 5) {
        matchedSamples.push({
          campaign: c.name,
          flow: flow.name,
          flowId: flow.id,
        });
      }
    } else {
      unmatchedDrafts.push(c.name);
    }
  }

  console.log(`\n📊 Match results:`);
  console.log(`  drafts in DB:            ${drafts.length}`);
  console.log(`  EIKONA flows in Klaviyo: ${flowMatches.length}`);
  console.log(`  matched drafts:          ${matched} (${((matched / drafts.length) * 100).toFixed(0)}%)`);
  console.log(`  unmatched drafts:        ${unmatchedDrafts.length}`);

  console.log(`\n✅ Sample matches:`);
  for (const m of matchedSamples) {
    console.log(`  campaign: ${m.campaign}`);
    console.log(`     flow: [${m.flowId}] ${m.flow}\n`);
  }

  if (unmatchedDrafts.length > 0) {
    console.log(`❌ Sample unmatched drafts:`);
    for (const name of unmatchedDrafts.slice(0, 5)) {
      console.log(`  ${name}`);
    }
  }

  // How many EIKONA flows have no matching draft?
  const matchedFlowIds = new Set<string>();
  for (const c of drafts) {
    const flow = flowByNormalized.get(normalizeCampaign(c.name));
    if (flow) matchedFlowIds.add(flow.id);
  }
  const orphanFlows = flowMatches.filter((f) => !matchedFlowIds.has(f.id));
  console.log(`\nℹ️  EIKONA flows with NO matching campaign draft: ${orphanFlows.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("✗ probe failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
