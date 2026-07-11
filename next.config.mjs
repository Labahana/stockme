/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@shopify/polaris"],
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@shopify/polaris"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
