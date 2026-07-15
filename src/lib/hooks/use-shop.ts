"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ShopifyGlobal = {
  config?: { shop?: string; host?: string };
  idToken?: () => Promise<string>;
};

function shopifyGlobal(): ShopifyGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { shopify?: ShopifyGlobal }).shopify;
}

function readAppBridgeConfig(): { shop: string; host: string } {
  const cfg = shopifyGlobal()?.config;
  return {
    shop: cfg?.shop?.trim() ?? "",
    host: cfg?.host?.trim() ?? "",
  };
}

function useEmbeddedParam(name: "shop" | "host") {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get(name)?.trim() ?? "";
  const [fromBridge, setFromBridge] = useState(() =>
    name === "shop" ? readAppBridgeConfig().shop : readAppBridgeConfig().host,
  );

  useEffect(() => {
    if (fromUrl) return;

    const sync = () => {
      const value = readAppBridgeConfig()[name];
      if (value) setFromBridge(value);
      return value;
    };

    if (sync()) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (sync() || attempts >= 50) {
        window.clearInterval(timer);
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [fromUrl, name]);

  return fromUrl || fromBridge;
}

/** Shop domain from URL (?shop=) or App Bridge config (embedded admin). */
export function useShop() {
  return useEmbeddedParam("shop");
}

/** Host token from URL (?host=) or App Bridge config. */
export function useHost() {
  return useEmbeddedParam("host");
}

export function apiUrl(path: string, shop: string, host?: string | null) {
  const params = new URLSearchParams();
  if (shop) params.set("shop", shop);
  if (host) params.set("host", host);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function withSessionHeaders(init?: RequestInit): Promise<Headers> {
  const headers = new Headers(init?.headers);
  const idToken = shopifyGlobal()?.idToken;
  if (idToken) {
    try {
      const token = await idToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Fall through — backend may allow query-only in development
    }
  }
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

/** fetch() a fully built same-origin URL with App Bridge session token. */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = await withSessionHeaders(init);
  return fetch(url, { ...init, headers });
}

/**
 * fetch() to app APIs with App Bridge session token (Authorization: Bearer).
 * App Bridge also injects this for same-origin fetches; we set it explicitly for reliability.
 *
 * Overload styles:
 * - shopFetch(path, shop, host, init?)
 * - shopFetch(path, shop, init?)  // host omitted
 */
export async function shopFetch(
  path: string,
  shop: string,
  hostOrInit?: string | null | RequestInit,
  init?: RequestInit,
): Promise<Response> {
  const hostIsInit =
    hostOrInit != null &&
    typeof hostOrInit === "object" &&
    !Array.isArray(hostOrInit);
  const host = hostIsInit ? null : (hostOrInit as string | null | undefined);
  const requestInit = hostIsInit ? (hostOrInit as RequestInit) : init;
  return authFetch(apiUrl(path, shop, host), requestInit);
}

export function installUrl(shop: string, host?: string | null) {
  if (!shop) return "";
  const params = new URLSearchParams({ shop });
  if (host) params.set("host", host);
  return `/api/auth?${params.toString()}`;
}
