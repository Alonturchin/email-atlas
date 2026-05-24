"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Heart } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  patchCampaign,
  type CampaignDetail,
  type CampaignListItem,
} from "@/lib/api-client";
import { prettifyProductSlug } from "@/lib/extract-products";
import { cn } from "@/lib/utils";
import { CampaignCard } from "./campaign-card";

interface Props {
  campaign: CampaignDetail;
  similar: CampaignListItem[];
}

export function CampaignDetailView({ campaign: initial, similar }: Props) {
  const [favorited, setFavorited] = useState(initial.favorited);
  const qc = useQueryClient();

  const fav = useMutation({
    mutationFn: (next: boolean) => patchCampaign(initial.id, { favorited: next }),
    onMutate: (next) => setFavorited(next),
    onError: () => setFavorited(initial.favorited),
    onSettled: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-neutral-500 hover:text-orange-600"
        >
          <ArrowLeft className="h-3 w-3" /> back to gallery
        </Link>
      </div>

      <header className="mb-8 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-baseline gap-2 text-[11px] font-medium uppercase tracking-widest text-neutral-500">
            <span>{formatDate(initial.sendDate)}</span>
            {initial.holiday && (
              <span className="rounded-sm bg-orange-600 px-1.5 py-0.5 text-[10px] text-white">
                {initial.holiday}
              </span>
            )}
            {initial.season && (
              <span className="rounded-sm border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-700">
                {initial.season}
              </span>
            )}
            <span className="rounded-sm border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-700">
              {initial.status}
            </span>
            {initial.categories?.map((c) => (
              <span
                key={c}
                className="rounded-sm border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-700"
              >
                {c}
              </span>
            ))}
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-neutral-900">
            {initial.name || "(untitled)"}
          </h1>
          {initial.subject && (
            <p className="mt-3 text-lg text-neutral-700">{initial.subject}</p>
          )}
          {initial.previewText && (
            <p className="mt-1 text-sm text-neutral-500">
              {initial.previewText}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {initial.templateId && (
            <a
              href={klaviyoTemplateUrl(initial.templateId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium uppercase tracking-wider text-neutral-700 hover:border-neutral-400 hover:text-neutral-900"
              title="Open template in Klaviyo"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Klaviyo
            </a>
          )}
          <button
            type="button"
            onClick={() => fav.mutate(!favorited)}
            aria-pressed={favorited}
            aria-label={favorited ? "Unfavorite" : "Favorite"}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors",
              favorited
                ? "border-orange-600 bg-orange-600 text-white hover:bg-orange-700 hover:border-orange-700"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:text-neutral-900",
            )}
          >
            <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
          </button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {initial.templateHtml ? (
            <iframe
              srcDoc={initial.templateHtml}
              title={initial.name || "email preview"}
              sandbox=""
              loading="eager"
              className="block h-[calc(100vh-220px)] min-h-[600px] w-full border-0"
            />
          ) : (
            <div className="flex h-[600px] items-center justify-center bg-neutral-50 text-xs font-medium uppercase tracking-widest text-neutral-400">
              no template html available
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <MetricBlock label="Recipients" value={formatNumber(initial.recipients)} big />

          <div className="grid grid-cols-2 gap-3">
            <MetricBlock label="Open" value={formatPct(initial.openRate)} />
            <MetricBlock label="Click" value={formatPct(initial.clickRate)} />
            <MetricBlock label="CTOR" value={formatPct(initial.ctor)} />
            <MetricBlock label="Unsub" value={formatPct(initial.unsubscribeRate)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricBlock label="Revenue" value={formatMoney(initial.revenue)} accent />
            <MetricBlock label="AOV" value={formatMoney(initial.aov)} />
            <MetricBlock label="Conv. rate" value={formatPct(initial.conversionRate)} />
          </div>

          {initial.products.length > 0 && (
            <div className="border-t border-neutral-200 pt-4">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
                Products mentioned ({initial.products.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {initial.products.map((p) => (
                  <Link
                    key={p}
                    href={`/?products=${encodeURIComponent(p)}`}
                    className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-orange-700 hover:border-orange-400"
                  >
                    {prettifyProductSlug(p)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {initial.tags.length > 0 && (
            <div className="border-t border-neutral-200 pt-4">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {initial.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {initial.audienceNames.length > 0 && (
            <div className="border-t border-neutral-200 pt-4">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
                Audiences ({initial.audienceNames.length})
              </div>
              <div className="text-[10px] text-neutral-500">
                {initial.audienceNames.slice(0, 6).join(" · ")}
                {initial.audienceNames.length > 6 &&
                  ` · +${initial.audienceNames.length - 6} more`}
              </div>
            </div>
          )}

          <div className="border-t border-neutral-200 pt-4 text-[10px] font-medium uppercase tracking-widest text-neutral-400">
            synced {formatDate(initial.lastSyncedAt)}
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-[11px] font-medium uppercase tracking-widest text-neutral-500">
            Similar campaigns
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {similar.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetricBlock({
  label,
  value,
  big = false,
  accent = false,
}: {
  label: string;
  value: string;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-white p-3",
        accent ? "border-orange-200" : "border-neutral-200",
      )}
    >
      <div className="text-[9px] font-medium uppercase tracking-widest text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 tabular-nums",
          big
            ? "text-3xl font-semibold text-neutral-900"
            : accent
              ? "text-xl font-medium text-orange-700"
              : "text-xl font-medium text-neutral-900",
        )}
      >
        {value}
      </div>
    </div>
  );
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(iso: string): string {
  try {
    return DATE_FMT.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatNumber(n: number): string {
  if (!n) return "—";
  return n.toLocaleString();
}

function formatPct(v: number): string {
  if (!v) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function formatMoney(v: number): string {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v).toLocaleString()}`;
}

// Klaviyo deep-link helper — verified URL shape for the drag-and-drop editor.
function klaviyoTemplateUrl(templateId: string): string {
  return `https://www.klaviyo.com/email-template-editor/${templateId}`;
}
