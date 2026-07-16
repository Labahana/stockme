import { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Stocky rebuilt — inventory management, purchase orders, and forecasting for Shopify POS Pro merchants.",
  icons: {
    icon: [
      { url: "/brand/stockme-mark.svg", type: "image/svg+xml" },
      { url: "/app-store/stockme-favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/app-store/stockme-app-icon-1200.png" }],
  },
  other: {
    "shopify-api-key": process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

  return (
    <html lang="en">
      <head>
        {/* Required by App Bridge CDN — must appear before the App Bridge script */}
        <meta name="shopify-api-key" content={apiKey} />
        {/*
          Shopify requires App Bridge as an early, synchronous <script> in the
          document with no async / defer / type=module. next/script injects it
          with async, which aborts App Bridge and breaks window.shopify.idToken()
          → every embedded API call 401s. Keep this a plain <script> tag.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
