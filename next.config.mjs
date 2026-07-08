/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server-only packages must never be bundled into client code. The Anthropic
  // and Voyage SDKs (and the Supabase service-role client) live server-side only.
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
  },
};

export default nextConfig;
