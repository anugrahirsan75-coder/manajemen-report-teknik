"use client";
/**
 * Penjaga layar tetap menyala — dipakai papan monitor di ruang kantor.
 *
 * Televisi menganggap peramban yang tidak disentuh sebagai ruangan yang
 * ditinggalkan: sesudah beberapa menit layarnya digelapkan, dan papan
 * sertifikat yang seharusnya terbaca sepanjang hari baru muncul lagi kalau ada
 * yang memencet remote. Dua cara dipasang berdampingan karena tidak ada satu
 * pun yang jalan di semua televisi:
 *
 * 1. Screen Wake Lock — cara resminya, tapi baru ada di peramban yang cukup
 *    baru dan hanya bekerja lewat HTTPS. Kuncinya lepas sendiri tiap kali
 *    halaman tersembunyi, jadi diminta ulang saat halaman terlihat lagi.
 *
 * 2. Video bisu yang diputar berulang. Televisi tidak menggelapkan layar yang
 *    sedang memutar video — inilah yang menolong perangkat lama, termasuk
 *    peramban bawaan LG webOS yang tidak mengenal Wake Lock. Berkasnya hitam
 *    32×32 piksel, 1,6 KB, dan ditaruh sebesar satu piksel di sudut.
 *
 * Yang TIDAK bisa ditangani dari sini: pemati daya televisi itu sendiri
 * (Auto Power Off 4 jam, Sleep Timer, Energy Saving). Itu setelan di
 * televisinya dan harus dimatikan lewat remote.
 */
import { useEffect, useRef } from "react";

export function JagaNyala() {
  const video = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let kunci: { release?: () => Promise<void> } | null = null;
    let hidup = true;

    const minta = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (jenis: "screen") => Promise<{ release?: () => Promise<void> }> };
        };
        if (!nav.wakeLock?.request) return;
        const baru = await nav.wakeLock.request("screen");
        if (hidup) kunci = baru; else void baru.release?.();
      } catch {
        // televisi lama tidak mengenal Wake Lock — video di bawah yang bekerja
      }
    };

    void minta();
    const kembali = () => { if (document.visibilityState === "visible") void minta(); };
    document.addEventListener("visibilitychange", kembali);

    return () => {
      hidup = false;
      document.removeEventListener("visibilitychange", kembali);
      void kunci?.release?.().catch(() => {});
    };
  }, []);

  /*
   * Pemutaran video sesekali berhenti sendiri — televisi menjeda saat halaman
   * sempat tersembunyi, dan tidak selalu melanjutkannya. Diperiksa tiap
   * setengah menit; kalau berhenti, dijalankan lagi.
   */
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const jalan = () => { void v.play().catch(() => {}); };
    jalan();
    const t = setInterval(() => { if (v.paused || v.ended) jalan(); }, 30_000);
    document.addEventListener("visibilitychange", jalan);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", jalan); };
  }, []);

  return (
    <video ref={video} muted loop playsInline autoPlay preload="auto" aria-hidden tabIndex={-1}
      className="pointer-events-none fixed bottom-0 right-0 h-px w-px opacity-[0.02]">
      <source src="/layar-nyala.webm" type="video/webm" />
      <source src="/layar-nyala.mp4" type="video/mp4" />
    </video>
  );
}
