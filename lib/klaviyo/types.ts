import { z } from "zod";

// JSON:API resource identifier ({ type, id }).
const RelationshipRef = z.object({
  type: z.string(),
  id: z.string(),
});

// ---------- Campaigns list ----------
// GET /api/campaigns/?filter=equals(messages.channel,'email')&include=campaign-messages,tags

const CampaignAttributes = z
  .object({
    name: z.string(),
    status: z.string(),
    archived: z.boolean().optional(),
    send_time: z.string().nullable().optional(),
    scheduled_at: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    audiences: z
      .object({
        included: z.array(z.string()).optional(),
        excluded: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .passthrough();

const CampaignRelationships = z
  .object({
    // `data` may be absent when the caller didn't request the relationship
    // via ?include= — accept that shape as a no-op (empty list).
    "campaign-messages": z
      .object({ data: z.array(RelationshipRef).optional() })
      .optional(),
    tags: z
      .object({ data: z.array(RelationshipRef).optional() })
      .optional(),
  })
  .partial();

const CampaignResourceSchema = z.object({
  type: z.literal("campaign"),
  id: z.string(),
  attributes: CampaignAttributes,
  relationships: CampaignRelationships.optional(),
});

const TagResource = z.object({
  type: z.literal("tag"),
  id: z.string(),
  attributes: z.object({ name: z.string() }).passthrough(),
});

const CampaignMessageContent = z
  .object({
    subject: z.string().nullable().optional(),
    preview_text: z.string().nullable().optional(),
    from_email: z.string().nullable().optional(),
    from_label: z.string().nullable().optional(),
    reply_to_email: z.string().nullable().optional(),
  })
  .passthrough();

const CampaignMessageDefinition = z
  .object({
    channel: z.string().optional(),
    label: z.string().nullable().optional(),
    content: CampaignMessageContent.nullable().optional(),
  })
  .passthrough();

const CampaignMessageResourceSchema = z.object({
  type: z.literal("campaign-message"),
  id: z.string(),
  attributes: z
    .object({
      label: z.string().nullable().optional(),
      channel: z.string().optional(),
      // Older revisions inline `content` at attributes; newer ones nest under `definition`.
      content: CampaignMessageContent.nullable().optional(),
      definition: CampaignMessageDefinition.nullable().optional(),
      send_times: z.array(z.unknown()).optional(),
    })
    .passthrough(),
  relationships: z
    .object({
      // Some campaign-messages return `relationships.template` without an
      // inner `data` field at all — accept missing or null.
      template: z
        .object({ data: RelationshipRef.nullable().optional() })
        .optional(),
      campaign: z
        .object({ data: RelationshipRef.nullable().optional() })
        .optional(),
    })
    .partial()
    .optional(),
});

// `included` is heterogeneous (tags + campaign-messages + occasionally others).
// We only read the `tag` resources here — campaign-messages get re-fetched
// individually below — so anything not a tag is parsed permissively.
const IncludedResource = z.union([
  TagResource,
  z
    .object({
      type: z.string(),
      id: z.string(),
    })
    .passthrough(),
]);

export const CampaignsListResponse = z.object({
  data: z.array(CampaignResourceSchema),
  included: z.array(IncludedResource).optional(),
  links: z
    .object({
      self: z.string().optional(),
      next: z.string().nullable().optional(),
      prev: z.string().nullable().optional(),
    })
    .partial()
    .optional(),
});

// ---------- Single campaign-message ----------
// GET /api/campaign-messages/{id}/
export const CampaignMessageResponse = z.object({
  data: CampaignMessageResourceSchema,
});

// ---------- Template ----------
// GET /api/templates/{id}/
const TemplateResourceSchema = z.object({
  type: z.literal("template"),
  id: z.string(),
  attributes: z
    .object({
      // Klaviyo returns null for some old/system templates — accept it.
      name: z.string().nullable().optional(),
      editor_type: z.string().nullable().optional(),
      html: z.string().nullable().optional(),
      text: z.string().nullable().optional(),
      created: z.string().nullable().optional(),
      updated: z.string().nullable().optional(),
    })
    .passthrough(),
});

export const TemplateResponse = z.object({ data: TemplateResourceSchema });

// ---------- Metrics list ----------
// GET /api/metrics/?filter=equals(name,'Placed Order')
const MetricResource = z.object({
  type: z.literal("metric"),
  id: z.string(),
  attributes: z
    .object({
      name: z.string(),
      integration: z.unknown().optional(),
    })
    .passthrough(),
});

export const MetricsListResponse = z.object({
  data: z.array(MetricResource),
});

// ---------- Campaign values report ----------
// POST /api/campaign-values-reports/
export const CampaignValuesReportResponse = z.object({
  data: z.object({
    type: z.literal("campaign-values-report"),
    attributes: z.object({
      results: z.array(
        z.object({
          groupings: z
            .object({
              campaign_id: z.string(),
              send_channel: z.string().optional(),
            })
            .passthrough(),
          statistics: z
            .object({
              recipients: z.number().nullable().optional(),
              open_rate: z.number().nullable().optional(),
              click_rate: z.number().nullable().optional(),
              click_to_open_rate: z.number().nullable().optional(),
              conversion_rate: z.number().nullable().optional(),
              conversion_value: z.number().nullable().optional(),
              unsubscribe_rate: z.number().nullable().optional(),
              average_order_value: z.number().nullable().optional(),
            })
            .passthrough(),
        }),
      ),
    }),
  }),
});

// ---------- Flows list ----------
// GET /api/flows/
const FlowResourceSchema = z.object({
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
});

export const FlowsListResponse = z.object({
  data: z.array(FlowResourceSchema),
  links: z
    .object({ next: z.string().nullable().optional() })
    .passthrough()
    .optional(),
});

// ---------- Flow values report ----------
// POST /api/flow-values-reports/
export const FlowValuesReportResponse = z.object({
  data: z.object({
    type: z.literal("flow-values-report"),
    attributes: z.object({
      results: z.array(
        z.object({
          groupings: z
            .object({
              flow_id: z.string(),
              flow_message_id: z.string().optional(),
              send_channel: z.string().optional(),
            })
            .passthrough(),
          statistics: z
            .object({
              recipients: z.number().nullable().optional(),
              open_rate: z.number().nullable().optional(),
              click_rate: z.number().nullable().optional(),
              click_to_open_rate: z.number().nullable().optional(),
              conversion_rate: z.number().nullable().optional(),
              conversion_value: z.number().nullable().optional(),
              unsubscribe_rate: z.number().nullable().optional(),
              average_order_value: z.number().nullable().optional(),
            })
            .passthrough(),
        }),
      ),
    }),
  }),
});

// ---------- Inferred TS types ----------
export type CampaignResource = z.infer<typeof CampaignResourceSchema>;
export type CampaignMessageResource = z.infer<typeof CampaignMessageResourceSchema>;
export type TemplateResource = z.infer<typeof TemplateResourceSchema>;
export type CampaignsListResponseT = z.infer<typeof CampaignsListResponse>;
export type CampaignMessageResponseT = z.infer<typeof CampaignMessageResponse>;
export type TemplateResponseT = z.infer<typeof TemplateResponse>;
export type MetricsListResponseT = z.infer<typeof MetricsListResponse>;
export type CampaignValuesReportResponseT = z.infer<typeof CampaignValuesReportResponse>;
export type FlowResource = z.infer<typeof FlowResourceSchema>;
export type FlowsListResponseT = z.infer<typeof FlowsListResponse>;
export type FlowValuesReportResponseT = z.infer<typeof FlowValuesReportResponse>;
