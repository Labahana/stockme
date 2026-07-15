import { Metadata } from "next";
import Script from "next/script";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Stocky rebuilt — inventory management, purchase orders, and forecasting for Shopify POS Pro merchants.",
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
        <meta name="shopify-api-key" content={apiKey} />
      </head>
      <body>
        <Script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
