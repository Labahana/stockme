"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLoading } from "@/components/app-loading";

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");
  const host = searchParams.get("host");

  useEffect(() => {
    const params = new URLSearchParams();
    if (shop) params.set("shop", shop);
    if (host) params.set("host", host);
    params.set("create", "1");
    router.replace(`/app/purchase-orders?${params.toString()}`);
  }, [router, shop, host]);

  return <AppLoading />;
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <RedirectInner />
    </Suspense>
  );
}
