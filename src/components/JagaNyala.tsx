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
import { useEffect, useRef, useState } from "react";

export function JagaNyala() {
  const video = useRef<HTMLVideoElement | null>(null);
  /** dilaporkan di pojok layar supaya bisa diperiksa dari depan televisi */
  const [keadaan, setKeadaan] = useState({ video: false, kunci: false, suara: false });

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
        if (hidup) { kunci = baru; setKeadaan((k) => ({ ...k, kunci: true })); }
        else void baru.release?.();
      } catch {
        // televisi lama tidak mengenal Wake Lock — video di bawah yang bekerja
      }
    };

    void minta();
    const kembali = () => { if (document.visibilityState === "visible") void minta(); };
    document.addEventListener("visibilitychange", kembali);
    // sebagian peramban hanya memberi kunci sesudah ada tekanan tombol
    window.addEventListener("keydown", kembali);
    window.addEventListener("click", kembali);

    return () => {
      hidup = false;
      document.removeEventListener("visibilitychange", kembali);
      window.removeEventListener("keydown", kembali);
      window.removeEventListener("click", kembali);
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

    /*
     * Berkasnya mulai dalam keadaan BISU, karena hanya media bisu yang boleh
     * diputar sendiri tanpa ada yang menekan tombol lebih dulu. Tetapi banyak
     * televisi tidak menghitung media bisu sebagai "sedang ditonton" — layarnya
     * tetap digelapkan meski videonya berjalan. Jadi begitu ada tekanan tombol
     * pertama dari remote, bisunya dilepas.
     *
     * Tidak ada bunyi yang keluar: jalur suaranya memang sunyi sungguhan, bukan
     * suara yang dikecilkan. Volumenya pun ditahan sangat rendah supaya kalau
     * suatu saat berkasnya tertukar, tidak ada yang mengagetkan seisi ruangan.
     */
    const nyaringkan = () => {
      if (!v.muted) return;
      v.muted = false;
      v.volume = 0.02;
      void v.play().then(() => setKeadaan((k) => ({ ...k, suara: !v.muted })))
        .catch(() => { v.muted = true; });   // ditolak — kembali bisu, video tetap jalan
    };
    window.addEventListener("keydown", nyaringkan);
    window.addEventListener("click", nyaringkan);
    /*
     * Diperiksa tiap lima detik, bukan setengah menit. Televisi menghitung diam
     * dalam hitungan menit; pemutaran yang berhenti setengah menit sudah cukup
     * membuatnya menyimpulkan tidak ada yang menonton.
     */
    const t = setInterval(() => {
      if (v.paused || v.ended) jalan();
      setKeadaan((k) => (k.video === !v.paused ? k : { ...k, video: !v.paused }));
    }, 5_000);
    document.addEventListener("visibilitychange", jalan);
    /*
     * Sebagian peramban televisi menolak memutar apa pun sebelum ada sentuhan
     * tombol pertama. Karena itu tiap tekanan remote — tombol apa saja, termasuk
     * yang dipakai membangunkan layar — dipakai sekalian untuk menjalankannya.
     */
    window.addEventListener("keydown", jalan);
    window.addEventListener("click", jalan);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", jalan);
      window.removeEventListener("keydown", jalan);
      window.removeEventListener("click", jalan);
      window.removeEventListener("keydown", nyaringkan);
      window.removeEventListener("click", nyaringkan);
    };
  }, []);

  return (
    <>
      {/*
        Videonya SELEBAR LAYAR, bukan satu piksel di sudut.
        Piksel tunggal cukup untuk telepon genggam, tetapi televisi memutuskan
        "sedang ditonton atau tidak" dari gambar yang benar-benar memenuhi
        layar. Isinya hitam pekat di atas latar yang juga hitam, jadi tidak ada
        yang terlihat berubah; ia duduk di belakang seluruh isi halaman.

        MP4 didahulukan: peramban webOS lebih sering menolak VP8/WebM, dan
        sumber pertama yang gagal diputar tidak selalu dilanjutkan ke berikutnya.
      */}
      <video ref={video} muted loop playsInline autoPlay preload="auto" aria-hidden tabIndex={-1}
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover opacity-[0.03]">
        <source src="/layar-nyala.mp4" type="video/mp4" />
        <source src="/layar-nyala.webm" type="video/webm" />
      </video>

      {/*
        Penanda kecil di pojok. Papan ini dipasang di ruangan lain, jadi satu-
        satunya cara mengetahui penjaganya bekerja adalah membacanya dari depan
        televisi — tanpa ini, layar yang mati tidak bisa dibedakan antara
        "penjaganya gagal" dan "setelan televisinya yang mematikan".
      */}
      <span className="pointer-events-none fixed bottom-1 left-2 z-50 select-none text-[10px] tabular-nums text-white/25">
        jaga layar: {keadaan.video ? "video ✓" : "video ✕"} · {keadaan.suara ? "suara ✓" : "suara ✕ (pencet 1 tombol remote)"} · {keadaan.kunci ? "wake lock ✓" : "wake lock ✕"}
      </span>
    </>
  );
}
