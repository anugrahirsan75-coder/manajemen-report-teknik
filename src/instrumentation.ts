/**
 * Dijalankan sekali saat server Next hidup.
 *
 * Di laptop kantor (server lokal port 3001, dijaga watchdog.vbs) inilah yang
 * menyalakan Juru Baca: permintaan kapal terbaca sendiri sepanjang laptop
 * menyala, tanpa perlu ada tab peramban yang terbuka.
 *
 * Di Vercel sengaja TIDAK dijadwalkan — server awan tak mungkin menjangkau
 * Ollama di laptop, dan fungsi tanpa server pun tidak hidup terus-menerus
 * untuk menjalankan jadwal.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL) return;
  if (process.env.JURU_BACA_OTOMATIS === "0") return;
  const { jadwalkanJuruBaca } = await import("@/lib/lapor/juruBacaServer");
  jadwalkanJuruBaca();
}
