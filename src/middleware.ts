import { NextResponse } from "next/server";

/**
 * Lightweight compression hint middleware.
 * Vercel already gzips responses; we only set caching policy for static assets.
 * Do NOT set Content-Encoding without compressing the body.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
