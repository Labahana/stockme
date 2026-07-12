import { redirect } from "next/navigation";

/** Wireframe route alias → existing stocktakes page */
export default function StockTakesAliasPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const suffix = qs.toString();
  redirect(`/app/stocktakes${suffix ? `?${suffix}` : ""}`);
}
