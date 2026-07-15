import Link from "next/link";
import { StockmeLogo } from "@/components/brand/StockmeLogo";
import { APP_NAME } from "@/lib/constants";

export const metadata = {
  title: `Privacy Policy — ${APP_NAME}`,
};

export default function PrivacyPage() {
  return (
    <main className="stockme-marketing min-h-screen text-[#1a2e28]">
      <header className="border-b border-[#d7e8e1]/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label={`${APP_NAME} home`}>
            <StockmeLogo size="md" />
          </Link>
          <a
            href="mailto:support@stockme.gentletap.co"
            className="text-sm text-[#4a6b62] hover:text-[#0D7377]"
          >
            Support
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight">{APP_NAME} Privacy Policy</h1>
        <p className="mt-2 text-sm text-[#5a736b]">Last updated: July 9, 2026</p>

        <section className="mt-8 space-y-4 text-base leading-relaxed text-[#2d3f39]">
          <p>
            {APP_NAME} (&quot;we&quot;, &quot;us&quot;) is operated by GentleTap. This policy
            describes how we handle data when you install and use our Shopify app at{" "}
            <strong>stockme.gentletap.co</strong>.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-[#1a2e28]">Data we collect</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Shop domain, staff email (if provided in settings), and OAuth access tokens</li>
            <li>Product, variant, inventory, location, and cost data synced from Shopify</li>
            <li>Purchase orders, suppliers, stocktakes, and transfers you create in the app</li>
            <li>Billing status via Shopify&apos;s billing API (we do not store payment card data)</li>
          </ul>

          <h2 className="pt-4 text-xl font-semibold text-[#1a2e28]">Data we do not collect</h2>
          <p>
            We do not store Shopify customer names, emails, or order PII. Inventory apps
            operate on product and stock data, not buyer identities.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-[#1a2e28]">How we use data</h2>
          <p>
            Data is used solely to provide inventory management features: sync, forecasting,
            purchase orders, reports, and email alerts you configure. We do not sell merchant data.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-[#1a2e28]">Data retention & deletion</h2>
          <p>
            When you uninstall the app, OAuth tokens are removed. Shopify may send a{" "}
            <code className="rounded bg-[#e8f0ed] px-1">shop/redact</code> webhook after
            uninstall; we delete all shop data within 30 days of that request.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-[#1a2e28]">Sub-processors</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Supabase (PostgreSQL database hosting)</li>
            <li>Vercel (application hosting)</li>
            <li>Inngest (background job processing)</li>
            <li>Resend (optional transactional email for alerts and PO notifications)</li>
          </ul>

          <h2 className="pt-4 text-xl font-semibold text-[#1a2e28]">Contact</h2>
          <p>
            Questions or GDPR requests:{" "}
            <a className="text-[#0D7377] underline" href="mailto:support@stockme.gentletap.co">
              support@stockme.gentletap.co
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
