/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow large image uploads via GraphQL (base64 strings can be sizeable)
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
