export type SortKey = "date" | "revenue" | "openRate" | "clickRate";
export type SortOrder = "asc" | "desc";
export type Season = "Summer" | "Spring" | "Winter" | "Fall";

export interface CampaignFilters {
  q?: string;
  holiday?: string;
  season?: Season;
  tags?: string[];
  categories?: string[];
  products?: string[];
  year?: number;
  month?: number;
  minOpenRate?: number;
  sort?: SortKey;
  order?: SortOrder;
  favoritesOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CampaignListItem {
  id: string;
  name: string;
  subject: string;
  previewText: string | null;
  sendDate: string;
  sendYear: number;
  sendMonth: number;
  status: string;
  thumbnailUrl: string | null;
  tags: string[];
  categories: string[];
  products: string[];
  holiday: string | null;
  season: Season | null;
  audienceNames: string[];
  recipients: number;
  openRate: number;
  clickRate: number;
  ctor: number;
  conversionRate: number;
  revenue: number;
  aov: number;
  unsubscribeRate: number;
  favorited: boolean;
  lastSyncedAt: string;
}

export interface CampaignDetail extends CampaignListItem {
  templateHtml: string | null;
  templateId: string | null;
}

export interface CampaignListResponse {
  items: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FacetsResponse {
  tags: { tag: string; count: number }[];
  categories: { category: string; count: number }[];
  products: { product: string; count: number }[];
  holidays: { holiday: string; count: number }[];
  seasons: { season: string; count: number }[];
  years: { year: number; count: number }[];
  months: { month: number; count: number }[];
}

function buildSearchParams(filters: CampaignFilters): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
    else sp.set(k, String(v));
  }
  return sp;
}

export async function fetchCampaigns(
  filters: CampaignFilters,
): Promise<CampaignListResponse> {
  const sp = buildSearchParams(filters);
  const res = await fetch(`/api/campaigns?${sp.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch campaigns: ${res.status}`);
  return res.json();
}

export async function fetchCampaign(id: string): Promise<CampaignDetail> {
  const res = await fetch(`/api/campaigns/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch campaign ${id}: ${res.status}`);
  return res.json();
}

export async function fetchFacets(): Promise<FacetsResponse> {
  const res = await fetch(`/api/campaigns/facets`);
  if (!res.ok) throw new Error(`Failed to fetch facets: ${res.status}`);
  return res.json();
}

export async function patchCampaign(
  id: string,
  data: { favorited?: boolean },
): Promise<{ id: string; favorited: boolean }> {
  const res = await fetch(`/api/campaigns/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update campaign ${id}: ${res.status}`);
  return res.json();
}
