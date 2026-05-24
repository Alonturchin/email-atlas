/**
 * Phase ad-hoc: explore Klaviyo flows to figure out how EIKONA flows relate to
 * draft campaigns of the same name. Run inside the container:
 *
 *   docker compose exec web pnpm tsx scripts/probe-flows.ts
 */

import { klaviyoGet } from "../lib/klaviyo/client";
import { z } from "zod";

const FlowList = z.object({
  data: z.array(
    z.object({
      type: z.literal("flow"),
      id: z.string(),
      attributes: z
        .object({
          name: z.string().nullable().optional(),
          status: z.string().nullable().optional(),
          archived: z.boolean().nullable().optional(),
          created: z.string().nullable().optional(),
          updated: z.string().nullable().optional(),
          trigger_type: z.string().nullable().optional(),
        })
        .passthrough(),
    }),
  ),
  links: z
    .object({ next: z.string().nullable().optional() })
    .passthrough()
    .optional(),
});

async function main() {
  console.log("→ Listing flows (paginated)…");
  const all: { id: string; name: string | null; status: string | null }[] = [];
  let next: string | null = null;
  let pages = 0;
  do {
    const page = await klaviyoGet(next ?? "/api/flows/", FlowList);
    pages++;
    for (const f of page.data) {
      all.push({
        id: f.id,
        name: f.attributes.name ?? null,
        status: f.attributes.status ?? null,
      });
    }
    next = page.links?.next ?? null;
  } while (next);

  console.log(`  ✓ ${all.length} flows across ${pages} page(s)`);
  console.log("\nStatus breakdown:");
  const statusCount = new Map<string, number>();
  for (const f of all) {
    statusCount.set(f.status ?? "—", (statusCount.get(f.status ?? "—") ?? 0) + 1);
  }
  for (const [s, c] of [...statusCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(15)} ${c}`);
  }

  const eikona = all.filter((f) => /^eikona/i.test(f.name ?? ""));
  console.log(`\nEIKONA-prefixed flows: ${eikona.length}`);
  for (const f of eikona.slice(0, 20)) {
    console.log(`  ${f.id}  [${f.status ?? "—"}]  ${f.name}`);
  }
  if (eikona.length > 20) console.log(`  …and ${eikona.length - 20} more`);

  // Also: any flow that has EIKONA anywhere in the name
  const eikonaSubstring = all.filter(
    (f) => /eikona/i.test(f.name ?? "") && !/^eikona/i.test(f.name ?? ""),
  );
  if (eikonaSubstring.length > 0) {
    console.log(
      `\nFlows containing 'EIKONA' but not starting with it: ${eikonaSubstring.length}`,
    );
    for (const f of eikonaSubstring.slice(0, 10)) {
      console.log(`  ${f.id}  [${f.status ?? "—"}]  ${f.name}`);
    }
  }
}

main().catch((err) => {
  console.error("✗ probe-flows failed:", err);
  process.exit(1);
});
