import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Tenant middleware — extracts schoolId (and userId/role) from the
 * authenticated session and forwards them as trusted request headers
 * (x-school-id, x-user-id, x-user-role) to downstream handlers.
 * Unauthenticated requests to protected routes are redirected to /login.
 */
const PUBLIC_PATHS = ["/login", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(req.headers);
  if (req.auth?.user) {
    // Trusted tenant context, resolved server-side from the session.
    requestHeaders.set("x-school-id", req.auth.user.schoolId);
    requestHeaders.set("x-user-id", req.auth.user.id);
    requestHeaders.set("x-user-role", req.auth.user.role);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

/** Server-side helper: read the tenant headers set by the middleware. */
export function getTenantHeaders(req: NextRequest): {
  schoolId: string | null;
  userId: string | null;
  role: string | null;
} {
  return {
    schoolId: req.headers.get("x-school-id"),
    userId: req.headers.get("x-user-id"),
    role: req.headers.get("x-user-role"),
  };
}
