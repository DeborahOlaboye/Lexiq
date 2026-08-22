/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  output: "standalone",
  webpack: (config) => {
    // Privy imports optional packages not available in all environments
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@stripe/crypto": false,
      "@farcaster/mini-app-solana": false,
    };
    return config;
  },
};
export default config;
