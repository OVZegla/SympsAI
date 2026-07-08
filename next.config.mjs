/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server-only packages must never be bundled into client code. The Anthropic
  // SDK (and the Supabase service-role client) live server-side only. Embeddings
  // run on a local Ollama server reached only from server code.
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
  },
};

export default nextConfig;
