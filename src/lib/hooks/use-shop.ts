"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ShopifyGlobal = {
  config?: { shop?: string; host?: string };
};

function readAppBridgeConfig(): { shop: string; host: string } {
  if (typeof window === "undefined") return { shop: "", host: "" };
  const cfg = (window as unknown as { shopify?: ShopifyGlobal }).shopify?.config;
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

export function installUrl(shop: string, host?: string | null) {
  if (!shop) return "";
  const params = new URLSearchParams({ shop });
  if (host) params.set("host", host);
  return `/api/auth?${params.toString()}`;
}
