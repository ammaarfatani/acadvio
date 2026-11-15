/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async redirects() {
    return [
      {
        source: "/school-admin/data-management/migration",
        destination: "/school-admin/data-management/complete-school-import",
        permanent: true,
      },
      {
        source: "/:slug/admin/data-management/migration",
        destination: "/:slug/admin/data-management/complete-school-import",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [{source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ]}];
  },
};

export default nextConfig;

