import { NextRequest, NextResponse } from "next/server";

/** Minimal Node-style response for @shopify/shopify-api OAuth in App Router. */
export function createRawResponse() {
  const headers: Record<string, string | string[]> = {};
  let statusCode = 200;
  let body = "";

  return {
    getHeader(key: string) {
      const val = headers[key.toLowerCase()];
      return Array.isArray(val) ? val[0] : val;
    },
    getHeaders() {
      return headers;
    },
    setHeader(key: string, value: string | string[]) {
      headers[key.toLowerCase()] = value;
    },
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    writeHead(code: number, hdrs?: Record<string, string | string[]>) {
      statusCode = code;
      if (hdrs) {
        for (const [key, value] of Object.entries(hdrs)) {
          this.setHeader(key, value);
        }
      }
    },
    end(chunk?: string) {
      if (chunk) body += chunk;
    },
    getBody() {
      return body;
    },
  };
}

export function toNextResponse(rawResponse: ReturnType<typeof createRawResponse>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(rawResponse.getHeaders())) {
    if (Array.isArray(value)) {
      for (const part of value) headers.append(key, part);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const status = rawResponse.statusCode;
  const isRedirect = status >= 300 && status < 400 && headers.has("location");

  // Build the response ourselves (instead of NextResponse.redirect) so that
  // every header set by Shopify — crucially the signed OAuth state cookie
  // (Set-Cookie) — is preserved on redirects. Dropping it breaks the callback.
  return new NextResponse(isRedirect ? null : rawResponse.getBody() || null, {
    status,
    headers,
  });
}

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
