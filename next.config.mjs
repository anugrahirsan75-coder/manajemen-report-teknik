/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sertakan file template (docx/xlsx + logo) ke bundle serverless function /api/generate
  experimental: {
    // menyalakan src/instrumentation.ts — di situ Juru Baca sisi server dijadwalkan
    instrumentationHook: true,
    outputFileTracingIncludes: {
      "/api/generate": ["./templates/**/*"],
      "/api/generate-all": ["./templates/**/*"],
      "/api/material/generate": ["./templates/material/**/*"],
      "/api/material/generate-all": ["./templates/material/**/*"],
      "/api/sppbj/generate": ["./templates/sppbj/**/*"],
      "/api/sppbj/generate-all": ["./templates/sppbj/**/*"],
      "/api/nonpr/generate": ["./templates/nonpr/**/*"],
      // halaman terbuka mengunduh SPPBJ memakai template yang sama
      "/api/monitoring/pengadaan/[id]/sppbj": ["./templates/sppbj/**/*"],
      // indeks harga (60 ribu item) dibaca di sisi server, tidak dikirim ke peramban
      "/api/harga/cari": ["./data/hargaIndex.json"],
      "/api/harga/cocok": ["./data/hargaIndex.json"],
    },
  },
};

export default nextConfig;
