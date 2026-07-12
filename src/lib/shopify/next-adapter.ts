import { NextRequest } from "next/server";

/** Prefer configured app URL; fall back to the incoming request host. */
export function resolveAppHost(request?: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).host;
    } catch {
      // ignore invalid URL
    }
  }
  return request?.nextUrl.host ?? "stocky-rho.vercel.app";
}
