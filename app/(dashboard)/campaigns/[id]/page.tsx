import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseJsonStringArray } from "@/lib/utils";
import { CampaignDetailView } from "@/components/campaign-detail-view";
import type { CampaignDetail, CampaignListItem, Season } from "@/lib/api-client";

const LIST_SELECT = {
  id: true,
  name: true,
  subject: true,
  previewText: true,
  sendDate: true,
  sendYear: true,
  sendMonth: true,
  status: true,
  thumbnailUrl: true,
  tags: true,
  categories: true,
  products: true,
  holiday: true,
  season: true,
  audienceNames: true,
  recipients: true,
  openRate: true,
  clickRate: true,
  ctor: true,
  conversionRate: true,
  revenue: true,
  aov: true,
  unsubscribeRate: true,
  favorited: true,
  lastSyncedAt: true,
} satisfies Prisma.CampaignSelect;

function serialize<
  T extends {
    tags: string;
    categories: string;
    products: string;
    audienceNames: string;
    sendDate: Date;
    lastSyncedAt: Date;
    season: string | null;
  },
>(
  c: T,
): Omit<
  T,
  | "tags"
  | "categories"
  | "products"
  | "audienceNames"
  | "sendDate"
  | "lastSyncedAt"
  | "season"
> & {
  tags: string[];
  categories: string[];
  products: string[];
  audienceNames: string[];
  sendDate: string;
  lastSyncedAt: string;
  season: Season | null;
} {
  return {
    ...c,
    tags: parseJsonStringArray(c.tags),
    categories: parseJsonStringArray(c.categories),
    products: parseJsonStringArray(c.products),
    audienceNames: parseJsonStringArray(c.audienceNames),
    sendDate: c.sendDate.toISOString(),
    lastSyncedAt: c.lastSyncedAt.toISOString(),
    season: (c.season as Season | null) ?? null,
  };
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();

  const tags = parseJsonStringArray(campaign.tags);

  // Similar = same holiday OR shares ≥1 tag, excluding self. Sorted by revenue.
  const orConditions: Prisma.CampaignWhereInput[] = [];
  if (campaign.holiday) orConditions.push({ holiday: campaign.holiday });
  for (const t of tags) {
    orConditions.push({ tags: { contains: `"${t}"` } });
  }

  const similar =
    orConditions.length === 0
      ? []
      : await prisma.campaign.findMany({
          where: {
            id: { not: campaign.id },
            OR: orConditions,
          },
          orderBy: { revenue: "desc" },
          take: 6,
          select: LIST_SELECT,
        });

  const detail: CampaignDetail = {
    ...serialize(campaign),
    templateHtml: campaign.templateHtml,
    templateId: campaign.templateId,
  };
  const similarSerialized: CampaignListItem[] = similar.map(serialize);

  return <CampaignDetailView campaign={detail} similar={similarSerialized} />;
}
