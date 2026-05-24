"use client";

import Link from "next/link";
import { Heart, KeyRound, LogOut, Search, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useFilters } from "@/lib/hooks/use-filters";
import { cn } from "@/lib/utils";

interface SessionUser {
  email: string;
  name: string | null;
  role: "ADMIN" | "MEMBER";
}

interface TopBarProps {
  user: SessionUser | null;
  lastSyncedAt: string | null;
}

export function TopBar({ user, lastSyncedAt }: TopBarProps) {
  const { filters, setFilters } = useFilters();
  const [localQ, setLocalQ] = useState(filters.q ?? "");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setLocalQ(filters.q ?? "");
  }, [filters.q]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if ((localQ || "") !== (filters.q || "")) {
        setFilters({ q: localQ || undefined });
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-display text-lg font-semibold tracking-tight text-neutral-900">
            Inbox <span className="text-orange-600">Atlas</span>
          </span>
        </Link>

        <div className="relative flex-1 max-w-2xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Search campaigns by name or subject…"
            className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
          />
        </div>

        <button
          type="button"
          onClick={() => setFilters({ favoritesOnly: !filters.favoritesOnly })}
          aria-pressed={!!filters.favoritesOnly}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium uppercase tracking-wider transition-colors",
            filters.favoritesOnly
              ? "border-orange-600 bg-orange-600 text-white hover:bg-orange-700 hover:border-orange-700"
              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:text-neutral-900",
          )}
        >
          <Heart
            className={cn("h-3.5 w-3.5", filters.favoritesOnly && "fill-current")}
          />
          Favorites
        </button>

        {user?.role === "ADMIN" && (
          <Link
            href="/admin/users"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium uppercase tracking-wider text-neutral-700 hover:border-neutral-400 hover:text-neutral-900"
          >
            <Shield className="h-3.5 w-3.5" />
            Admin
          </Link>
        )}

        <LastSyncChip iso={lastSyncedAt} />

        {user && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 text-xs text-neutral-700 hover:border-neutral-400"
              aria-expanded={menuOpen}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold uppercase text-white">
                {(user.name || user.email).charAt(0)}
              </span>
              <span className="hidden md:inline max-w-[140px] truncate">
                {user.name || user.email}
              </span>
            </button>
            {menuOpen && (
              <>
                {/* click-outside catcher */}
                <button
                  type="button"
                  aria-label="close menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
                  <div className="border-b border-neutral-100 px-3 py-2 text-xs">
                    <div className="font-medium text-neutral-900">
                      {user.name || "—"}
                    </div>
                    <div className="text-neutral-500">{user.email}</div>
                    <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
                      {user.role}
                    </div>
                  </div>
                  <Link
                    href="/account/password"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 border-b border-neutral-100 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Change password
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function LastSyncChip({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const date = new Date(iso);
  return (
    <span
      className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-[10px] font-medium uppercase tracking-widest text-neutral-500"
      title={`Last Klaviyo sync: ${date.toLocaleString("en-US", {
        timeZone: "America/New_York",
        timeZoneName: "short",
      })}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Synced {formatRelative(date)}
    </span>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(diff / 86_400_000);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" fill="#0a0a0a" />
      <path d="M16 5 L27.5 27 L4.5 27 Z" fill="#ea580c" />
      <rect x="10.5" y="20" width="11" height="2.2" rx="0.4" fill="#0a0a0a" />
    </svg>
  );
}
