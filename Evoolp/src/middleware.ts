import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const allCookies = request.cookies.getAll();
  const hasSession = allCookies.some(
    (c) => c.name.includes("session") || c.name.includes("token")
  );

  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/teacher/:path*",
    "/student/:path*",
    "/parent/:path*",
  ],
};
