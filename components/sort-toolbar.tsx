"use client";

import { ArrowDownUp, Grid2x2, Grid3x3, LayoutGrid } from "lucide-react";
import type { SortKey, SortOrder } from "@/lib/api-client";
import { useFilters } from "@/lib/hooks/use-filters";
import { cn } from "@/lib/utils";

interface Props {
  total: number | undefined;
  isLoading: boolean;
  density: 3 | 4 | 5;
  onDensityChange: (d: 3 | 4 | 5) => void;
}

const SORT_LABEL: Record<SortKey, string> = {
  date: "Date",
  revenue: "Revenue",
  openRate: "Open rate",
  clickRate: "Click rate",
};

export function SortToolbar({
  total,
  isLoading,
  density,
  onDensityChange,
}: Props) {
  const { filters, setFilters } = useFilters();
  const sort = filters.sort ?? "date";
  const order = filters.order ?? "desc";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
      <p className="text-[11px] font-medium uppercase tracking-widest text-neutral-500">
        {isLoading
          ? "Loading…"
          : total === undefined
            ? "—"
            : `${total.toLocaleString()} ${total === 1 ? "campaign" : "campaigns"}`}
      </p>

      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white pl-3 pr-1 py-1 text-xs text-neutral-700">
          <ArrowDownUp className="h-3.5 w-3.5 text-neutral-400" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            Sort
          </span>
          <select
            value={sort}
            onChange={(e) => setFilters({ sort: e.target.value as SortKey })}
            className="bg-transparent text-xs text-neutral-900 focus:outline-none"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              setFilters({
                order: (order === "desc" ? "asc" : "desc") as SortOrder,
              })
            }
            className="rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Toggle sort order"
          >
            {order === "desc" ? "↓" : "↑"}
          </button>
        </label>

        <div className="hidden sm:flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5">
          {([3, 4, 5] as const).map((d) => {
            const Icon = d === 3 ? Grid2x2 : d === 4 ? LayoutGrid : Grid3x3;
            return (
              <button
                key={d}
                type="button"
                aria-label={`${d}-column grid`}
                onClick={() => onDensityChange(d)}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:text-neutral-900",
                  density === d &&
                    "bg-orange-600 text-white hover:bg-orange-700 hover:text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
