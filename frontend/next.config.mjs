/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=()",
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // Consolidate ranking signal: redirect alt domains to canonical skininsightai.app (308 permanent)
      {
        source: "/:path*",
        has: [{ type: "host", value: "skin-score.app" }],
        destination: "https://skininsightai.app/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.skin-score.app" }],
        destination: "https://skininsightai.app/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.skininsightai.app" }],
        destination: "https://skininsightai.app/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "project1-beta-pied.vercel.app" }],
        destination: "https://skininsightai.app/:path*",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
