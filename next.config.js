/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Allow dev-mode access from LAN IP / hostname (Next 16 blocks cross-origin
  // /_next/* requests by default, which silently breaks client hydration).
  allowedDevOrigins: ['192.168.2.222', 'localhost', '127.0.0.1', 'survey.zycadus.com'],
};

module.exports = nextConfig;
