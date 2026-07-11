import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/constants";

export default function HomePage({
  searchParams,
}: {
  searchParams: { shop?: string; host?: string };
}) {
  const shop = searchParams.shop?.trim();
  const host = searchParams.host?.trim();

  // Shopify embedded admin loads App URL with shop + host — go to the app shell.
  if (shop && host) {
    redirect(
      `/app?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`,
    );
  }

  const installHref = shop
    ? `/api/auth?shop=${encodeURIComponent(shop)}`
    : null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold">{APP_NAME}</span>
          <a
            href="mailto:support@stockme.gentletap.co"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            support@stockme.gentletap.co
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
          Stocky shuts down August 31, 2026 — migrate before mid-August
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Move from Stocky in 10 minutes. Keep your PO history.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          {APP_NAME} is a Stocky replacement built for Shopify POS Pro merchants:
          inventory sync, purchase orders, forecasting, stocktakes, transfers, and
          barcode scanning — from $15/month.
        </p>

        {installHref ? (
          <Link
            href={installHref}
            className="mt-10 inline-flex rounded-lg bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow hover:bg-emerald-700"
          >
            Install on {shop}
          </Link>
        ) : (
          <p className="mx-auto mt-10 max-w-md rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Install from the Shopify App Store, or open from your Shopify admin.
          </p>
        )}
      </section>

      <section className="border-t border-slate-200 bg-white py-16">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 sm:grid-cols-3">
          <div>
            <h2 className="text-lg font-semibold">Import Stocky CSVs</h2>
            <p className="mt-2 text-sm text-slate-600">
              Upload your Stocky purchase order exports and supplier spreadsheet.
              PO numbers and received quantities are preserved for your records.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Same workflow, fixed</h2>
            <p className="mt-2 text-sm text-slate-600">
              Partial PO receiving, per-shipment invoices, cross-location inventory,
              and sub-second loads at 5,000+ SKUs.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">$15 / $29 / $39</h2>
            <p className="mt-2 text-sm text-slate-600">
              Cheaper than $50–200/month alternatives. 14-day free trial via Shopify
              billing — no separate invoice.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12 text-center text-sm text-slate-500">
        <Link href="/privacy" className="underline hover:text-slate-700">
          Privacy policy
        </Link>
        {" · "}
        <a href="mailto:support@stockme.gentletap.co" className="underline hover:text-slate-700">
          Support
        </a>
      </section>
    </main>
  );
}
