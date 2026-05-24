import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/top-bar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user
    ? {
        email: session.user.email ?? "",
        name: session.user.name ?? null,
        role: session.user.role,
      }
    : null;

  // Show the most recent successful Klaviyo sync timestamp in the top bar.
  // Aggregate is one indexed query, cheap enough to run on every layout render.
  const lastSync = await prisma.campaign.aggregate({
    _max: { lastSyncedAt: true },
  });
  const lastSyncedAt = lastSync._max.lastSyncedAt?.toISOString() ?? null;

  return (
    <>
      <Suspense fallback={<div className="h-16 border-b border-neutral-200" />}>
        <TopBar user={user} lastSyncedAt={lastSyncedAt} />
      </Suspense>
      {children}
    </>
  );
}
