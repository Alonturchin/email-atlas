/**
 * Phase 2 probe: hits Klaviyo end-to-end with a real key, validates responses
 * against the Zod schemas, and prints a summary. Run inside the dev container:
 *
 *   docker compose exec web pnpm probe
 *
 * The web container inherits KLAVIYO_API_KEY from .env.local.
 */

import { klaviyoGet, klaviyoPost } from "../lib/klaviyo/client";
import {
  CampaignMessageResponse,
  CampaignValuesReportResponse,
  CampaignsListResponse,
  MetricsListResponse,
  TemplateResponse,
} from "../lib/klaviyo/types";

async function main() {
  console.log("→ Listing campaigns (first page, email channel)…");
  const list = await klaviyoGet("/api/campaigns/", CampaignsListResponse, {
    filter: "equals(messages.channel,'email')",
    include: "campaign-messages,tags",
  });
  console.log(`  ✓ ${list.data.length} campaigns returned`);
  console.log(`  ✓ ${list.included?.length ?? 0} included resources`);

  const first = list.data[0];
  if (!first) {
    console.log("  (no campaigns to drill into; stopping here)");
    return;
  }

  console.log(`→ Inspecting "${first.attributes.name}" (${first.id})`);

  const messageRef = first.relationships?.["campaign-messages"]?.data?.[0];
  let templateId: string | null = null;
  if (messageRef) {
    const msg = await klaviyoGet(
      `/api/campaign-messages/${messageRef.id}/`,
      CampaignMessageResponse,
    );
    const content =
      msg.data.attributes.definition?.content ?? msg.data.attributes.content;
    console.log(`  ✓ Subject: ${JSON.stringify(content?.subject ?? null)}`);
    console.log(`  ✓ Preview: ${JSON.stringify(content?.preview_text ?? null)}`);
    templateId = msg.data.relationships?.template?.data?.id ?? null;
  } else {
    console.log("  (no message relationship on this campaign)");
  }

  if (templateId) {
    const tpl = await klaviyoGet(
      `/api/templates/${templateId}/`,
      TemplateResponse,
    );
    const html = tpl.data.attributes.html ?? "";
    console.log(`  ✓ Template HTML: ${html.length.toLocaleString()} chars`);
  } else {
    console.log("  (no template attached)");
  }

  // Spec said filter=equals(name,'Placed Order') but Klaviyo no longer allows
  // filtering on `name` — only integration.name / integration.category. Fetch
  // all and match client-side.
  console.log("→ Looking up Placed Order metric…");
  const metrics = await klaviyoGet("/api/metrics/", MetricsListResponse);
  const placedOrder = metrics.data.find(
    (m) => m.attributes.name === "Placed Order",
  );
  if (!placedOrder) {
    console.log("  (no Placed Order metric on this account; stopping)");
    return;
  }
  console.log(`  ✓ Placed Order metric id: ${placedOrder.id}`);

  console.log("→ Fetching campaign-values-report (last 365 days)…");
  const report = await klaviyoPost(
    "/api/campaign-values-reports/",
    CampaignValuesReportResponse,
    {
      data: {
        type: "campaign-values-report",
        attributes: {
          statistics: [
            "recipients",
            "open_rate",
            "click_rate",
            "click_to_open_rate",
            "conversion_rate",
            "conversion_value",
            "unsubscribe_rate",
            "average_order_value",
          ],
          timeframe: { key: "last_365_days" },
          conversion_metric_id: placedOrder.id,
        },
      },
    },
  );
  console.log(
    `  ✓ Report returned ${report.data.attributes.results.length} rows`,
  );

  console.log("\n✅ Probe successful — Klaviyo client wired and validated.");
}

main().catch((err) => {
  console.error("\n✗ Probe failed:");
  console.error(err);
  process.exit(1);
});
