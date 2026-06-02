/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sertakan file template (docx/xlsx + logo) ke bundle serverless function /api/generate
  experimental: {
    outputFileTracingIncludes: {
      "/api/generate": ["./templates/**/*"],
    },
  },
};

export default nextConfig;
