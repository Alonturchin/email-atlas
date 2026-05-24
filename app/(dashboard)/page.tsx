import { Suspense } from "react";
import { CampaignGrid } from "@/components/campaign-grid";
import { FilterSidebar } from "@/components/filter-sidebar";

export default function GalleryPage() {
  return (
    <div className="mx-auto flex max-w-[1600px] gap-8 px-6 py-6">
      <Suspense fallback={<aside className="w-60 shrink-0" />}>
        <FilterSidebar />
      </Suspense>
      <main className="min-w-0 flex-1">
        <Suspense fallback={<div className="h-64" />}>
          <CampaignGrid />
        </Suspense>
      </main>
    </div>
  );
}
