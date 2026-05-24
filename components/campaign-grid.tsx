"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchCampaigns,
  type CampaignListResponse,
} from "@/lib/api-client";
import { useFilters } from "@/lib/hooks/use-filters";
import { cn } from "@/lib/utils";
import { CampaignCard } from "./campaign-card";
import { SortToolbar } from "./sort-toolbar";

const DENSITY_CLASS: Record<3 | 4 | 5, string> = {
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
};

export function CampaignGrid() {
  const { filters, setFilters } = useFilters();
  const [density, setDensity] = useState<3 | 4 | 5>(4);

  const { data, isLoading, isError, isFetching } = useQuery<CampaignListResponse>({
    queryKey: ["campaigns", filters],
    queryFn: () => fetchCampaigns(filters),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

  return (
    <div className="space-y-4">
      <SortToolbar
        total={data?.total}
        isLoading={isLoading}
        density={density}
        onDensityChange={setDensity}
      />

      {isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Failed to load campaigns. Is the dev server up?
        </div>
      )}

      {isLoading ? (
        <SkeletonGrid density={density} />
      ) : data && data.items.length === 0 ? (
        <EmptyState />
      ) : data ? (
        <>
          <div
            className={cn(
              "grid grid-cols-1 gap-6 transition-opacity",
              DENSITY_CLASS[density],
              isFetching && "opacity-70",
            )}
          >
            {data.items.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>

          {data.totalPages > 1 && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              onChange={(p) => setFilters({ page: p })}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

function SkeletonGrid({ density }: { density: 3 | 4 | 5 }) {
  return (
    <div className={cn("grid grid-cols-1 gap-6", DENSITY_CLASS[density])}>
      {Array.from({ length: density * 2 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="aspect-[3/4] animate-pulse rounded-md border border-neutral-200 bg-neutral-100" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-200" />
          <div className="h-5 w-4/5 animate-pulse rounded bg-neutral-200" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
      <p className="text-[11px] font-medium uppercase tracking-widest text-neutral-500">
        No campaigns match these filters
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        Try clearing a few filters or broadening your search.
      </p>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 pt-4 text-xs font-medium uppercase tracking-widest text-neutral-500">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-40 disabled:hover:border-neutral-200 disabled:hover:text-neutral-700"
      >
        ← prev
      </button>
      <span>
        page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-40 disabled:hover:border-neutral-200 disabled:hover:text-neutral-700"
      >
        next →
      </button>
    </div>
  );
}
