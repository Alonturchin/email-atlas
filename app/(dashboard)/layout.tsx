import { Suspense } from "react";
import { auth } from "@/auth";
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

  return (
    <>
      <Suspense fallback={<div className="h-16 border-b border-neutral-200" />}>
        <TopBar user={user} />
      </Suspense>
      {children}
    </>
  );
}
