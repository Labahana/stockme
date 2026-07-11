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

/** Shop domain from URL (?shop=) or App Bridge config (embedded admin). */
export function useShop() {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("shop")?.trim() ?? "";
  const [fromBridge, setFromBridge] = useState("");

  useEffect(() => {
    if (fromUrl) return;
    const { shop } = readAppBridgeConfig();
    if (shop) setFromBridge(shop);
  }, [fromUrl]);

  return fromUrl || fromBridge;
}

/** Host token from URL (?host=) or App Bridge config. */
export function useHost() {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("host")?.trim() ?? "";
  const [fromBridge, setFromBridge] = useState("");

  useEffect(() => {
    if (fromUrl) return;
    const { host } = readAppBridgeConfig();
    if (host) setFromBridge(host);
  }, [fromUrl]);

  return fromUrl || fromBridge;
}

export function apiUrl(path: string, shop: string, host?: string | null) {
  const params = new URLSearchParams();
  if (shop) params.set("shop", shop);
  if (host) params.set("host", host);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function installUrl(shop: string) {
  return shop ? `/api/auth?shop=${encodeURIComponent(shop)}` : "";
}
