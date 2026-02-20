import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants/infrastructure";

/**
 * Next.js middleware for route protection.
 *
 * Runs in Edge Runtime — no Node.js-only APIs (no Redis, no fs, etc.).
 *
 * Auth mode: session-based (iron-session cookie + Redis).
 * Unauthenticated requests are redirected to /login.
 * /login and static assets are accessible without a session.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page, Next.js internals, and auth API routes without session
  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  // Check for session cookie presence (content validation happens server-side)
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
