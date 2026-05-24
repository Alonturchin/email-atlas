"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import {
  fetchFacets,
  type FacetsResponse,
  type Season,
} from "@/lib/api-client";
import { prettifyProductSlug } from "@/lib/extract-products";
import { useFilters } from "@/lib/hooks/use-filters";
import { cn } from "@/lib/utils";

const SEASON_ORDER: Season[] = ["Summer", "Fall", "Winter", "Spring"];

const MONTH_LABEL: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

export function FilterSidebar() {
  const { filters, setFilters, resetFilters } = useFilters();
  const { data: facets } = useQuery<FacetsResponse>({
    queryKey: ["facets"],
    queryFn: fetchFacets,
    staleTime: 5 * 60 * 1000,
  });
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);

  const hasAnyFilter =
    !!filters.q ||
    !!filters.holiday ||
    !!filters.season ||
    !!filters.tags?.length ||
    !!filters.categories?.length ||
    !!filters.products?.length ||
    filters.year !== undefined ||
    filters.month !== undefined ||
    filters.minOpenRate !== undefined ||
    !!filters.favoritesOnly;

  const visibleTags = facets?.tags ?? [];
  const tagsToShow = tagsExpanded ? visibleTags : visibleTags.slice(0, 12);
  const visibleProducts = facets?.products ?? [];
  const productsToShow = productsExpanded ? visibleProducts : visibleProducts.slice(0, 10);

  return (
    <aside className="sticky top-20 h-[calc(100vh-6rem)] w-60 shrink-0 self-start overflow-y-auto pb-8 text-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
          Filters
        </h2>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 hover:text-orange-600"
          >
            clear all
          </button>
        )}
      </div>

      <FilterSection label="Year">
        <div className="flex flex-wrap gap-1.5">
          {facets?.years.map(({ year, count }) => (
            <Pill
              key={year}
              active={filters.year === year}
              onClick={() =>
                setFilters({ year: filters.year === year ? undefined : year })
              }
            >
              {year}
              <span className="ml-1 text-[9px] opacity-60">{count}</span>
            </Pill>
          ))}
          {!facets && <Skeleton lines={3} />}
        </div>
      </FilterSection>

      <FilterSection label="Month">
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const count = facets?.months.find((x) => x.month === m)?.count ?? 0;
            const isActive = filters.month === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() =>
                  setFilters({ month: isActive ? undefined : m })
                }
                disabled={count === 0}
                className={cn(
                  "rounded-md border px-1 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors",
                  isActive
                    ? "border-orange-600 bg-orange-600 text-white"
                    : count === 0
                      ? "border-neutral-100 bg-neutral-50 text-neutral-300"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:text-neutral-900",
                )}
              >
                {MONTH_LABEL[m]}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection label="Seasons">
        <div className="flex flex-wrap gap-1.5">
          {SEASON_ORDER.map((s) => {
            const count =
              facets?.seasons.find((x) => x.season === s)?.count ?? 0;
            if (count === 0 && filters.season !== s) return null;
            return (
              <Pill
                key={s}
                active={filters.season === s}
                onClick={() =>
                  setFilters({ season: filters.season === s ? undefined : s })
                }
              >
                {s}
                <span className="ml-1 text-[9px] opacity-60">{count}</span>
              </Pill>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection label="Holidays">
        <div className="flex flex-wrap gap-1.5">
          {facets?.holidays.map(({ holiday, count }) => (
            <Pill
              key={holiday}
              active={filters.holiday === holiday}
              onClick={() =>
                setFilters({
                  holiday: filters.holiday === holiday ? undefined : holiday,
                })
              }
            >
              {holiday}
              <span className="ml-1 text-[9px] opacity-60">{count}</span>
            </Pill>
          ))}
          {!facets && <Skeleton lines={3} />}
        </div>
      </FilterSection>

      <FilterSection label="Categories">
        <div className="flex flex-wrap gap-1.5">
          {facets?.categories.map(({ category, count }) => {
            const active = filters.categories?.includes(category) ?? false;
            return (
              <Pill
                key={category}
                active={active}
                onClick={() => {
                  const next = new Set(filters.categories ?? []);
                  if (active) next.delete(category);
                  else next.add(category);
                  setFilters({
                    categories: next.size > 0 ? Array.from(next) : undefined,
                  });
                }}
              >
                {category}
                <span className="ml-1 text-[9px] opacity-60">{count}</span>
              </Pill>
            );
          })}
          {!facets && <Skeleton lines={3} />}
        </div>
      </FilterSection>

      <FilterSection label="Products">
        <div className="flex flex-wrap gap-1.5">
          {productsToShow.map(({ product, count }) => {
            const active = filters.products?.includes(product) ?? false;
            return (
              <Pill
                key={product}
                active={active}
                onClick={() => {
                  const next = new Set(filters.products ?? []);
                  if (active) next.delete(product);
                  else next.add(product);
                  setFilters({
                    products: next.size > 0 ? Array.from(next) : undefined,
                  });
                }}
              >
                {prettifyProductSlug(product)}
                <span className="ml-1 text-[9px] opacity-60">{count}</span>
              </Pill>
            );
          })}
          {!facets && <Skeleton lines={3} />}
        </div>
        {visibleProducts.length > 10 && (
          <button
            type="button"
            onClick={() => setProductsExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-neutral-500 hover:text-orange-600"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                productsExpanded && "rotate-180",
              )}
            />
            {productsExpanded ? "show less" : `show all (${visibleProducts.length})`}
          </button>
        )}
      </FilterSection>

      <FilterSection label="Tags">
        <div className="flex flex-wrap gap-1.5">
          {tagsToShow.map(({ tag, count }) => {
            const active = filters.tags?.includes(tag) ?? false;
            return (
              <Pill
                key={tag}
                active={active}
                onClick={() => {
                  const next = new Set(filters.tags ?? []);
                  if (active) next.delete(tag);
                  else next.add(tag);
                  setFilters({
                    tags: next.size > 0 ? Array.from(next) : undefined,
                  });
                }}
              >
                {tag}
                <span className="ml-1 text-[9px] opacity-60">{count}</span>
              </Pill>
            );
          })}
          {!facets && <Skeleton lines={4} />}
        </div>
        {visibleTags.length > 12 && (
          <button
            type="button"
            onClick={() => setTagsExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-neutral-500 hover:text-orange-600"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                tagsExpanded && "rotate-180",
              )}
            />
            {tagsExpanded ? "show less" : `show all (${visibleTags.length})`}
          </button>
        )}
      </FilterSection>

      <FilterSection label="Min open rate">
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={filters.minOpenRate ?? 0}
            onChange={(e) =>
              setFilters({
                minOpenRate:
                  Number(e.target.value) > 0
                    ? Number(e.target.value)
                    : undefined,
              })
            }
            className="w-full"
          />
          <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            <span>0%</span>
            <span className="text-orange-600">
              ≥ {((filters.minOpenRate ?? 0) * 100).toFixed(0)}%
            </span>
            <span>100%</span>
          </div>
        </div>
      </FilterSection>

      {hasAnyFilter && (
        <FilterSection label="Active">
          <div className="flex flex-wrap gap-1.5">
            {filters.q && (
              <RemoveChip
                label={`"${filters.q}"`}
                onRemove={() => setFilters({ q: undefined })}
              />
            )}
            {filters.year !== undefined && (
              <RemoveChip
                label={String(filters.year)}
                onRemove={() => setFilters({ year: undefined })}
              />
            )}
            {filters.month !== undefined && (
              <RemoveChip
                label={MONTH_LABEL[filters.month]}
                onRemove={() => setFilters({ month: undefined })}
              />
            )}
            {filters.season && (
              <RemoveChip
                label={filters.season}
                onRemove={() => setFilters({ season: undefined })}
              />
            )}
            {filters.holiday && (
              <RemoveChip
                label={filters.holiday}
                onRemove={() => setFilters({ holiday: undefined })}
              />
            )}
            {filters.categories?.map((c) => (
              <RemoveChip
                key={c}
                label={c}
                onRemove={() =>
                  setFilters({
                    categories: filters.categories?.filter((x) => x !== c),
                  })
                }
              />
            ))}
            {filters.products?.map((p) => (
              <RemoveChip
                key={p}
                label={prettifyProductSlug(p)}
                onRemove={() =>
                  setFilters({
                    products: filters.products?.filter((x) => x !== p),
                  })
                }
              />
            ))}
            {filters.tags?.map((t) => (
              <RemoveChip
                key={t}
                label={t}
                onRemove={() =>
                  setFilters({
                    tags: filters.tags?.filter((x) => x !== t),
                  })
                }
              />
            ))}
            {filters.minOpenRate !== undefined && (
              <RemoveChip
                label={`open ≥ ${(filters.minOpenRate * 100).toFixed(0)}%`}
                onRemove={() => setFilters({ minOpenRate: undefined })}
              />
            )}
            {filters.favoritesOnly && (
              <RemoveChip
                label="favorites"
                onRemove={() => setFilters({ favoritesOnly: undefined })}
              />
            )}
          </div>
        </FilterSection>
      )}
    </aside>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 border-t border-neutral-200 pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <h3 className="mb-2 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
        {label}
      </h3>
      {children}
    </section>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors",
        active
          ? "border-orange-600 bg-orange-600 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:text-neutral-900",
      )}
    >
      {children}
    </button>
  );
}

function RemoveChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-700">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`}>
        <X className="h-3 w-3 hover:text-orange-900" />
      </button>
    </span>
  );
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-6 w-16 animate-pulse rounded-full bg-neutral-100"
        />
      ))}
    </div>
  );
}
