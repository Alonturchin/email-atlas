"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type {
  CampaignFilters,
  Season,
  SortKey,
  SortOrder,
} from "@/lib/api-client";

const SEASONS: Season[] = ["Summer", "Spring", "Winter", "Fall"];
const SORTS: SortKey[] = ["date", "revenue", "openRate", "clickRate"];

export function useFilters(): {
  filters: CampaignFilters;
  setFilters: (patch: Partial<CampaignFilters>) => void;
  resetFilters: () => void;
} {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo<CampaignFilters>(() => {
    const seasonRaw = sp.get("season");
    const sortRaw = sp.get("sort");
    const orderRaw = sp.get("order");
    const yearRaw = sp.get("year");
    const monthRaw = sp.get("month");
    return {
      q: sp.get("q") || undefined,
      holiday: sp.get("holiday") || undefined,
      season: SEASONS.includes(seasonRaw as Season) ? (seasonRaw as Season) : undefined,
      tags: sp.getAll("tags").length ? sp.getAll("tags") : undefined,
      categories: sp.getAll("categories").length ? sp.getAll("categories") : undefined,
      products: sp.getAll("products").length ? sp.getAll("products") : undefined,
      year: yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined,
      month:
        monthRaw && /^([1-9]|1[0-2])$/.test(monthRaw)
          ? Number(monthRaw)
          : undefined,
      minOpenRate: sp.get("minOpenRate") ? Number(sp.get("minOpenRate")) : undefined,
      sort: SORTS.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : "date",
      order: orderRaw === "asc" ? "asc" : ("desc" as SortOrder),
      favoritesOnly: sp.get("favoritesOnly") === "true" || undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 24,
    };
  }, [sp]);

  const setFilters = useCallback(
    (patch: Partial<CampaignFilters>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "" || v === false) {
          next.delete(k);
        } else if (Array.isArray(v)) {
          next.delete(k);
          if (v.length > 0) v.forEach((x) => next.append(k, String(x)));
        } else {
          next.set(k, String(v));
        }
      }
      // Any filter change (other than page itself) resets to page 1.
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, sp],
  );

  const resetFilters = useCallback(() => {
    router.replace(pathname);
  }, [pathname, router]);

  return { filters, setFilters, resetFilters };
}
