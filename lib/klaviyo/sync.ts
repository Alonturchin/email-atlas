import "server-only";
import { prisma } from "@/lib/db";
import { deriveTagsFromName } from "@/lib/derive-tags";
import { extractProductSlugs } from "@/lib/extract-products";
import { klaviyoGet, klaviyoPost } from "./client";
import {
  loadEikonaOverlay,
  normalizeCampaignName,
} from "./eikona-flows";
import {
  CampaignMessageResponse,
  CampaignValuesReportResponse,
  CampaignsListResponse,
  MetricsListResponse,
  TemplateResponse,
  type CampaignResource,
} from "./types";

export interface SyncSummary {
  total: number;
  upserted: number;
  skipped: number;
  errors: number;
  flowOverlays: number;
  durationMs: number;
}

const log = (msg: string) => console.log(`[sync] ${msg}`);

/**
 * One full pull: list every email campaign, fetch its message + template,
 * pull metrics from the values report, enrich with holiday/season, and upsert
 * into Postgres. Idempotent — safe to re-run on a schedule.
 */
export async function runSync(): Promise<SyncSummary> {
  const start = Date.now();
  log("starting");

  // 1. Resolve Placed Order metric id (needed for the values report).
  // Spec said to filter by name, but Klaviyo only allows filtering metrics by
  // integration.name / integration.category — we fetch all and match by name.
  const metrics = await klaviyoGet("/api/metrics/", MetricsListResponse);
  const placedOrder = metrics.data.find(
    (m) => m.attributes.name === "Placed Order",
  );
  if (!placedOrder) {
    throw new Error("Placed Order metric not found on this Klaviyo account");
  }
  log(`placed-order metric id: ${placedOrder.id}`);

  // 2. Pull all campaign metrics in one POST.
  log("fetching campaign-values-report (last 365 days)");
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

  type Stats =
    (typeof report.data.attributes.results)[number]["statistics"];
  const statsByCampaign = new Map<string, Stats>();
  for (const row of report.data.attributes.results) {
    statsByCampaign.set(row.groupings.campaign_id, row.statistics);
  }
  log(`metrics rows: ${statsByCampaign.size}`);

  // 2b. EIKONA flow overlay — draft campaigns whose real metrics live in a
  // matching flow ("(EIKONA) Campaign Experiment - <same date+description>").
  log("loading EIKONA flow overlay");
  const overlay = await loadEikonaOverlay(placedOrder.id);
  log(
    `eikona flows: ${overlay.flowsFound} found, ${overlay.metricsFound} with metrics, ${overlay.metricsByNormalizedName.size} keyed by normalized name`,
  );

  // 3. Paginate /api/campaigns/ with tags + campaign-messages included.
  log("listing campaigns");
  const campaigns: CampaignResource[] = [];
  const tagNameById = new Map<string, string>();

  let nextUrl: string | null = null;
  let pageCount = 0;
  do {
    const page = await klaviyoGet(
      nextUrl ?? "/api/campaigns/",
      CampaignsListResponse,
      nextUrl
        ? undefined
        : {
            filter: "equals(messages.channel,'email')",
            include: "campaign-messages,tags",
          },
    );
    campaigns.push(...page.data);
    for (const inc of page.included ?? []) {
      if (inc.type === "tag") tagNameById.set(inc.id, inc.attributes.name);
    }
    nextUrl = page.links?.next ?? null;
    pageCount += 1;
  } while (nextUrl);
  log(`found ${campaigns.length} campaigns across ${pageCount} page(s)`);

  // 4. Per-campaign drill-down + upsert, run with bounded concurrency.
  // Concurrency 6 keeps us well under Klaviyo's burst limits (~75 rps) while
  // cutting wall-clock time ~6x vs sequential. The client's 429 retry covers
  // bursts.
  const CONCURRENCY = 6;
  let upserted = 0;
  let skipped = 0;
  let errors = 0;
  let completed = 0;
  let flowOverlays = 0;

  async function processOne(c: CampaignResource, idx: number): Promise<void> {
    const label = `[${idx + 1}/${campaigns.length}] ${c.id}`;
    try {
      const sendTimeStr =
        c.attributes.send_time ??
        c.attributes.scheduled_at ??
        c.attributes.created_at ??
        null;
      if (!sendTimeStr) {
        log(`${label} skip — no send/scheduled/created time`);
        skipped += 1;
        return;
      }
      const sendDate = new Date(sendTimeStr);

      let subject = "";
      let previewText: string | null = null;
      let templateHtml: string | null = null;
      let templateId: string | null = null;
      const messageRef = c.relationships?.["campaign-messages"]?.data?.[0];

      if (messageRef) {
        const msg = await klaviyoGet(
          `/api/campaign-messages/${messageRef.id}/`,
          CampaignMessageResponse,
        );
        const content =
          msg.data.attributes.definition?.content ??
          msg.data.attributes.content ??
          null;
        subject = content?.subject ?? "";
        previewText = content?.preview_text ?? null;

        templateId = msg.data.relationships?.template?.data?.id ?? null;
        if (templateId) {
          try {
            const tpl = await klaviyoGet(
              `/api/templates/${templateId}/`,
              TemplateResponse,
            );
            templateHtml = tpl.data.attributes.html ?? null;
          } catch (e) {
            // Per spec: missing/old templates are common (SMS, drafts).
            log(
              `${label} template ${templateId} fetch failed: ${(e as Error).message}`,
            );
          }
        }
      }

      const tagIds = c.relationships?.tags?.data?.map((t) => t.id) ?? [];
      const tagNames = tagIds.map((id) => tagNameById.get(id) ?? id);
      const audienceIds = c.attributes.audiences?.included ?? [];
      const stats = statsByCampaign.get(c.id);

      // Draft campaigns that match an EIKONA flow get their metrics overlaid
      // from the flow report — the campaign itself has 0 because nobody is
      // sent through it; the corresponding flow holds the real numbers.
      const isDraft = /^draft$/i.test(c.attributes.status);
      const flowMetrics =
        isDraft && (stats?.recipients ?? 0) === 0
          ? overlay.metricsByNormalizedName.get(
              normalizeCampaignName(c.attributes.name),
            )
          : undefined;
      if (flowMetrics) flowOverlays += 1;

      const derived = deriveTagsFromName(c.attributes.name);
      const data = {
        name: c.attributes.name,
        subject,
        previewText,
        sendDate,
        sendYear: sendDate.getUTCFullYear(),
        sendMonth: sendDate.getUTCMonth() + 1,
        status: c.attributes.status,
        templateHtml,
        templateId,
        tags: JSON.stringify(tagNames),
        categories: JSON.stringify(derived.categories),
        products: JSON.stringify(extractProductSlugs(templateHtml)),
        holiday: derived.holiday,
        season: derived.season,
        audienceNames: JSON.stringify(audienceIds),
        recipients: flowMetrics
          ? flowMetrics.recipients
          : Math.round(stats?.recipients ?? 0),
        openRate: flowMetrics?.openRate ?? stats?.open_rate ?? 0,
        clickRate: flowMetrics?.clickRate ?? stats?.click_rate ?? 0,
        ctor: flowMetrics?.ctor ?? stats?.click_to_open_rate ?? 0,
        conversionRate:
          flowMetrics?.conversionRate ?? stats?.conversion_rate ?? 0,
        revenue: flowMetrics?.revenue ?? stats?.conversion_value ?? 0,
        aov: flowMetrics?.aov ?? stats?.average_order_value ?? 0,
        unsubscribeRate:
          flowMetrics?.unsubscribeRate ?? stats?.unsubscribe_rate ?? 0,
        lastSyncedAt: new Date(),
      };

      await prisma.campaign.upsert({
        where: { id: c.id },
        create: { id: c.id, ...data },
        update: data,
      });
      upserted += 1;
    } catch (e) {
      errors += 1;
      log(`${label} ERROR: ${(e as Error).message}`);
    } finally {
      completed += 1;
      if (completed % 50 === 0) {
        log(
          `progress ${completed}/${campaigns.length} (upserted=${upserted} skipped=${skipped} errors=${errors})`,
        );
      }
    }
  }

  // Worker pool: each worker pulls indices off a shared cursor.
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= campaigns.length) return;
        await processOne(campaigns[idx], idx);
      }
    }),
  );

  const durationMs = Date.now() - start;
  log(
    `done in ${(durationMs / 1000).toFixed(1)}s — upserted=${upserted} skipped=${skipped} errors=${errors} flowOverlays=${flowOverlays}`,
  );

  return {
    total: campaigns.length,
    upserted,
    skipped,
    errors,
    flowOverlays,
    durationMs,
  };
}
