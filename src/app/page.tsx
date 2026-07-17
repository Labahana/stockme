import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StockmeLogo } from "@/components/brand/StockmeLogo";
import { APP_NAME } from "@/lib/constants";

const FEATURES = [
  { label: "Purchase orders", icon: "po" },
  { label: "Forecasts", icon: "chart" },
  { label: "Stocktakes", icon: "check" },
  { label: "Inventory insights", icon: "box" },
] as const;

const SHOTS = [
  {
    src: "/app-store/stockme-screenshot-inventory.png",
    alt: "Stockme inventory screen",
    label: "Inventory",
  },
  {
    src: "/app-store/stockme-screenshot-purchase-orders.png",
    alt: "Stockme purchase orders screen",
    label: "Purchase orders",
  },
  {
    src: "/app-store/stockme-screenshot-scan-receive.png",
    alt: "Stockme barcode receive screen",
    label: "Scan & receive",
  },
  {
    src: "/app-store/stockme-screenshot-pricing.png",
    alt: "Stockme pricing plans",
    label: "Simple pricing",
  },
] as const;

function FeatureIcon({ name }: { name: (typeof FEATURES)[number]["icon"] }) {
  if (name === "po") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 19h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M7 16V11M12 16V8M17 16V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M9 10l2 2 4-4M9 16l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HomePage({
  searchParams,
}: {
  searchParams: { shop?: string; host?: string };
}) {
  const shop = searchParams.shop?.trim();
  const host = searchParams.host?.trim();

  // App Store / install entry: never show marketing UI before OAuth.
  if (shop) {
    const params = new URLSearchParams({ shop });
    if (host) params.set("host", host);
    redirect(`/api/auth?${params.toString()}`);
  }

  return (
    <main className="stockme-marketing min-h-screen text-[#1a2e28]">
      <header className="relative z-10 border-b border-[#d7e8e1]/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label={`${APP_NAME} home`}>
            <StockmeLogo size="md" />
          </Link>
          <a
            href="mailto:support@stockme.gentletap.co"
            className="text-sm text-[#4a6b62] transition hover:text-[#0D7377]"
          >
            support@stockme.gentletap.co
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 78% 35%, rgba(201,235,222,0.9), transparent 42%), radial-gradient(circle at 12% 70%, rgba(216,243,232,0.55), transparent 38%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-6 pt-8 sm:pt-10">
          <p className="mb-5 text-center text-sm font-semibold text-[#c2410c] sm:text-left">
            Stocky shuts down August 31, 2026 — migrate before mid-August
          </p>
          <div className="stockme-hero-preview overflow-hidden rounded-2xl border border-[#d7e8e1] bg-white shadow-[0_28px_70px_-28px_rgba(10,92,76,0.45)]">
            <Image
              src="/app-store/stockme-feature-graphic.png"
              alt={`${APP_NAME} — Stocky's replacement for Shopify inventory. POs, forecasts, stocktakes from $15/mo.`}
              width={1600}
              height={900}
              priority
              className="h-auto w-full"
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <span className="inline-flex rounded-xl border border-[#c5ddd3] bg-white/90 px-5 py-3 text-sm text-[#4a6b62]">
              Install from the Shopify App Store, or open from your Shopify admin.
            </span>
            <Link
              href="/privacy"
              className="text-sm font-medium text-[#0D7377] underline-offset-4 hover:underline"
            >
              Privacy policy
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#0D7377] text-white">
        <div className="mx-auto grid max-w-6xl gap-0 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.label}
              className={`flex items-center gap-3 px-6 py-5 ${
                i > 0 ? "border-t border-white/20 sm:border-t-0 sm:border-l" : ""
              }`}
            >
              <FeatureIcon name={feature.icon} />
              <span className="text-sm font-medium tracking-wide">{feature.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold tracking-tight text-[#1a2e28]">
            Built for the same jobs as Stocky
          </h2>
          <p className="mt-2 max-w-2xl text-[#5a736b]">
            Inventory, purchase orders, receiving, and pricing — the workflow merchants
            already know.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {SHOTS.map((shot) => (
              <figure
                key={shot.src}
                className="overflow-hidden rounded-2xl border border-[#d7e8e1] bg-white shadow-sm"
              >
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  width={1200}
                  height={750}
                  className="h-auto w-full"
                />
                <figcaption className="border-t border-[#e8f0ed] px-4 py-3 text-sm font-medium text-[#0D7377]">
                  {shot.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#d7e8e1] bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:grid-cols-3">
          <div>
            <h2 className="text-lg font-semibold">Import Stocky CSVs</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5a736b]">
              Upload Stocky purchase order exports and your supplier spreadsheet.
              PO numbers and received quantities stay intact.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Same workflow, fixed</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5a736b]">
              Partial PO receiving, per-shipment invoices, cross-location inventory,
              and fast loads at 5,000+ SKUs.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">$15 / $29 / $39</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5a736b]">
              14-day free trial via Shopify billing — no separate invoice.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#d7e8e1] bg-[#f7fbf9] px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <StockmeLogo size="sm" />
          <div className="text-sm text-[#5a736b]">
            <Link href="/privacy" className="underline-offset-4 hover:text-[#0D7377] hover:underline">
              Privacy policy
            </Link>
            {" · "}
            <a
              href="mailto:support@stockme.gentletap.co"
              className="underline-offset-4 hover:text-[#0D7377] hover:underline"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
