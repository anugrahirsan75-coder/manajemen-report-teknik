/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sertakan file template (docx/xlsx + logo) ke bundle serverless function /api/generate
  experimental: {
    outputFileTracingIncludes: {
      "/api/generate": ["./templates/**/*"],
      "/api/generate-all": ["./templates/**/*"],
      "/api/material/generate": ["./templates/material/**/*"],
      "/api/material/generate-all": ["./templates/material/**/*"],
      "/api/sppbj/generate": ["./templates/sppbj/**/*"],
      "/api/sppbj/generate-all": ["./templates/sppbj/**/*"],
      "/api/nonpr/generate": ["./templates/nonpr/**/*"],
      // indeks harga (60 ribu item) dibaca di sisi server, tidak dikirim ke peramban
      "/api/harga/cari": ["./data/hargaIndex.json"],
    },
  },
};

export default nextConfig;
