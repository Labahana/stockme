import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";
import { PODetail } from "@/components/purchase-orders/PODetail";

export default function PurchaseOrderDetailPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <PODetail />
    </Suspense>
  );
}
