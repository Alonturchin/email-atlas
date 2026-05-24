import "server-only";
import { klaviyoGet, klaviyoPost } from "./client";
import {
  FlowsListResponse,
  type FlowsListResponseT,
  FlowValuesReportResponse,
  type FlowValuesReportResponseT,
  type FlowResource,
} from "./types";

/**
 * Some "campaigns" in Klaviyo are actually drafts whose real sends happen
 * inside a flow named after the same date+description. The user's naming
 * convention:
 *
 *   draft campaign: "[SCHEDULED] 24.05.26 - Memorial Day is tomorrow (Email) [Eikona Full Creative]"
 *   matching flow:  "(EIKONA) Campaign Experiment - 24.05.26 - Memorial Day is tomorrow (Email) [Eikona Full Creative] - 21394cee"
 *
 * Or "(EIKONA internal test)" instead of "(EIKONA)" for test runs.
 *
 * This module finds those flows, fetches their metrics, and exposes a lookup
 * keyed by the normalized middle-name so the sync can overlay flow metrics on
 * draft campaign rows.
 */

const FLOW_PREFIX_RE =
  /^\(EIKONA(?:\s+internal\s+test)?\)\s*Campaign\s+Experiment\s*-\s*/i;
const FLOW_HASH_SUFFIX_RE = /\s*-\s*[a-f0-9]{6,}\s*$/i;
const CAMPAIGN_PREFIX_RE = /^\[SCHEDULED\]\s*/i;

export function normalizeFlowName(name: string): string {
  return name
    .replace(FLOW_PREFIX_RE, "")
    .replace(FLOW_HASH_SUFFIX_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeCampaignName(name: string): string {
  return name
    .replace(CAMPAIGN_PREFIX_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isEikonaFlowName(name: string | null | undefined): boolean {
  return !!name && FLOW_PREFIX_RE.test(name);
}

export interface FlowMetrics {
  recipients: number;
  openRate: number;
  clickRate: number;
  ctor: number;
  conversionRate: number;
  revenue: number;
  aov: number;
  unsubscribeRate: number;
}

export interface EikonaOverlay {
  /** Lookup by normalizedCampaignName(campaign.name) → flow metrics. */
  metricsByNormalizedName: Map<string, FlowMetrics>;
  /** For logging — how many EIKONA flows we found. */
  flowsFound: number;
  /** For logging — how many had metrics in the report. */
  metricsFound: number;
}

/** Paginate `/api/flows/` and keep only those matching the EIKONA pattern. */
async function listEikonaFlows(): Promise<FlowResource[]> {
  const out: FlowResource[] = [];
  let next: string | null = null;
  do {
    const page: FlowsListResponseT = await klaviyoGet(
      next ?? "/api/flows/",
      FlowsListResponse,
    );
    for (const f of page.data) {
      if (isEikonaFlowName(f.attributes.name ?? null)) out.push(f);
    }
    next = page.links?.next ?? null;
  } while (next);
  return out;
}

/**
 * Fetch lifetime metrics for the given flow IDs via `flow-values-reports`.
 * Returns a map keyed by flow_id. Klaviyo limits the report's filter list, so
 * if we have many flows we send in batches.
 */
async function fetchFlowMetrics(
  flowIds: string[],
  placedOrderMetricId: string,
): Promise<Map<string, FlowMetrics>> {
  const byId = new Map<string, FlowMetrics>();
  if (flowIds.length === 0) return byId;

  // Klaviyo's filter parsers historically have URL/value-length limits even
  // for POST bodies. Batches of 50 keeps payloads comfortably small.
  const BATCH = 50;
  for (let i = 0; i < flowIds.length; i += BATCH) {
    const batch = flowIds.slice(i, i + BATCH);
    const report: FlowValuesReportResponseT = await klaviyoPost(
      "/api/flow-values-reports/",
      FlowValuesReportResponse,
      {
        data: {
          type: "flow-values-report",
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
            conversion_metric_id: placedOrderMetricId,
            filter: `contains-any(flow_id,["${batch.join('","')}"])`,
          },
        },
      },
    );

    // A flow has multiple messages — the report may emit one row per
    // (flow_id, flow_message_id, send_channel). Aggregate to flow level by
    // summing recipients & revenue and weight-averaging rates by recipients.
    type Acc = {
      recipients: number;
      openWeighted: number;
      clickWeighted: number;
      ctorWeighted: number;
      conversionWeighted: number;
      unsubWeighted: number;
      revenue: number;
      aovWeighted: number;
    };
    const accByFlow = new Map<string, Acc>();
    for (const row of report.data.attributes.results) {
      const fid = row.groupings.flow_id;
      const r = row.statistics.recipients ?? 0;
      const acc = accByFlow.get(fid) ?? {
        recipients: 0,
        openWeighted: 0,
        clickWeighted: 0,
        ctorWeighted: 0,
        conversionWeighted: 0,
        unsubWeighted: 0,
        revenue: 0,
        aovWeighted: 0,
      };
      acc.recipients += r;
      acc.openWeighted += (row.statistics.open_rate ?? 0) * r;
      acc.clickWeighted += (row.statistics.click_rate ?? 0) * r;
      acc.ctorWeighted += (row.statistics.click_to_open_rate ?? 0) * r;
      acc.conversionWeighted += (row.statistics.conversion_rate ?? 0) * r;
      acc.unsubWeighted += (row.statistics.unsubscribe_rate ?? 0) * r;
      acc.revenue += row.statistics.conversion_value ?? 0;
      acc.aovWeighted += (row.statistics.average_order_value ?? 0) * r;
      accByFlow.set(fid, acc);
    }
    for (const [fid, acc] of accByFlow) {
      const r = acc.recipients;
      byId.set(fid, {
        recipients: Math.round(r),
        openRate: r > 0 ? acc.openWeighted / r : 0,
        clickRate: r > 0 ? acc.clickWeighted / r : 0,
        ctor: r > 0 ? acc.ctorWeighted / r : 0,
        conversionRate: r > 0 ? acc.conversionWeighted / r : 0,
        unsubscribeRate: r > 0 ? acc.unsubWeighted / r : 0,
        revenue: acc.revenue,
        aov: r > 0 ? acc.aovWeighted / r : 0,
      });
    }
  }
  return byId;
}

/**
 * Top-level: list EIKONA flows, fetch their metrics, and return a normalized
 * lookup the sync can use.
 */
export async function loadEikonaOverlay(
  placedOrderMetricId: string,
): Promise<EikonaOverlay> {
  const flows = await listEikonaFlows();
  const ids = flows.map((f) => f.id);
  const metricsByFlowId = await fetchFlowMetrics(ids, placedOrderMetricId);

  const metricsByNormalizedName = new Map<string, FlowMetrics>();
  // If duplicate normalized names occur (live + draft variant of same flow),
  // prefer whichever has more recipients (more real data).
  for (const flow of flows) {
    const name = flow.attributes.name;
    if (!name) continue;
    const metrics = metricsByFlowId.get(flow.id);
    if (!metrics) continue;
    const key = normalizeFlowName(name);
    const existing = metricsByNormalizedName.get(key);
    if (!existing || metrics.recipients > existing.recipients) {
      metricsByNormalizedName.set(key, metrics);
    }
  }

  return {
    metricsByNormalizedName,
    flowsFound: flows.length,
    metricsFound: metricsByFlowId.size,
  };
}
