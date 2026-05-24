import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Default policy: everything is gated. Allowlist a few public paths:
 *  - /login              — must be reachable to authenticate
 *  - /api/auth/*         — Auth.js endpoints
 *  - /api/sync           — uses its own x-sync-token guard (cron + manual)
 *  - /icon.svg, favicon  — static assets surfaced as routes
 *  - Next.js internals   — already excluded by `matcher` below
 *
 * Admin-only paths (/admin/*) additionally require role === "ADMIN".
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/sync" ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico";

  const session = req.auth;

  // Not signed in → bounce to /login (carry the original URL as ?from=)
  if (!session && !isPublic) {
    const url = new URL("/login", req.nextUrl.origin);
    if (pathname !== "/") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Signed in but trying to revisit /login → send to gallery
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  // Admin gating
  if (pathname.startsWith("/admin")) {
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Skip Next internals + static assets the matcher can recognize by suffix.
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
