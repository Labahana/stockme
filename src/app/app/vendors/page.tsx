import { redirect } from "next/navigation";

/** Wireframe route alias → existing suppliers page */
export default function VendorsAliasPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const suffix = qs.toString();
  redirect(`/app/suppliers${suffix ? `?${suffix}` : ""}`);
}
