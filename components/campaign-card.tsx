"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  patchCampaign,
  type CampaignListItem,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { TemplatePreview } from "./template-preview";

interface Props {
  campaign: CampaignListItem;
}

export function CampaignCard({ campaign: c }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (html !== null) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            obs.disconnect();
            fetch(`/api/campaigns/${c.id}`)
              .then((r) => r.json())
              .then((d) => setHtml(d.templateHtml ?? ""))
              .catch(() => setHtml(""));
            break;
          }
        }
      },
      { rootMargin: "300px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [c.id, html]);

  const qc = useQueryClient();
  const favMutation = useMutation({
    mutationFn: (favorited: boolean) =>
      patchCampaign(c.id, { favorited }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  return (
    <div ref={cardRef} className="group">
      <Link
        href={`/campaigns/${c.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm transition-all group-hover:border-neutral-400 group-hover:shadow-md">
          <TemplatePreview html={html} className="h-full w-full" />
          <button
            type="button"
            aria-label={c.favorited ? "Unfavorite" : "Favorite"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              favMutation.mutate(!c.favorited);
            }}
            className={cn(
              "absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full backdrop-blur transition-colors",
              c.favorited
                ? "bg-orange-600 text-white hover:bg-orange-700"
                : "bg-white/85 text-neutral-700 hover:bg-white",
            )}
          >
            <Heart
              className={cn("h-3.5 w-3.5", c.favorited && "fill-current")}
            />
          </button>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
          <span>{formatDate(c.sendDate)}</span>
          {c.holiday && (
            <span className="rounded-sm bg-orange-600 px-1.5 py-0.5 text-[9px] text-white">
              {c.holiday}
            </span>
          )}
        </div>

        <h3 className="mt-1 line-clamp-2 text-base font-medium leading-snug text-neutral-900 group-hover:text-orange-600">
          {c.name || "(untitled)"}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-sm text-neutral-600">
          {c.subject || "—"}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-2">
          <Stat label="Open" value={formatPct(c.openRate)} />
          <Stat label="Click" value={formatPct(c.clickRate)} />
          <Stat label="Revenue" value={formatMoney(c.revenue)} />
        </div>
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-medium uppercase tracking-widest text-neutral-500">
        {label}
      </div>
      <div className="text-sm tabular-nums text-neutral-900">{value}</div>
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

function formatPct(v: number): string {
  if (!v) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function formatMoney(v: number): string {
  if (!v) return "—";
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}
