"use client";
/**
 * Halaman "Tempel Tabel SPPB/J" — dibuka sebagai JENDELA TERPISAH.
 *
 * Sebagai kotak melayang di dalam halaman isi, alat ini selalu terkurung
 * tinggi jendela induknya; pada tabel puluhan baris pemakainya menggulung
 * terus-menerus antara pemetaan kolom, daftar baris, dan tombol masuk.
 * Sebagai jendela sendiri, ukurannya bisa dibesarkan dan diletakkan
 * berdampingan dengan Excel-nya.
 *
 * Hasilnya dikirim balik ke jendela pemanggil lewat postMessage. Tidak lewat
 * localStorage: dua pengadaan yang dibuka bersamaan akan saling menimpa
 * titipan datanya, dan kekeliruan macam itu tidak kelihatan sampai itemnya
 * mendarat di pengadaan yang salah.
 */
import { useEffect, useState } from "react";
import TempelTabelSppbj, { ItemTempel } from "@/components/TempelTabelSppbj";

// Halaman Next.js hanya boleh mengekspor default + config bawaan, jadi
// penanda pesan ditulis sebagai tetapan biasa (kembarannya ada di
// src/app/sppbj/isi/page.tsx yang menerimanya).
const PESAN = "sppbj-tempel";

export default function HalamanTempel() {
  const [kapalAwal, setKapalAwal] = useState("");
  const [selesai, setSelesai] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setKapalAwal(p.get("kapal") || "");
  }, []);

  const kirim = (items: ItemTempel[]) => {
    try {
      window.opener?.postMessage({ tipe: PESAN, items }, window.location.origin);
    } catch { /* jendela induk sudah ditutup — pesan di bawah yang memberi tahu */ }
    setSelesai(true);
    setTimeout(() => window.close(), 400);
  };

  if (selesai) {
    return (
      <main className="h-screen grid place-items-center p-8 text-center">
        <div>
          <p className="text-3xl mb-2">✓</p>
          <p className="font-extrabold text-slate-800">Item dikirim ke layar pengadaan.</p>
          <p className="text-sm text-slate-500 mt-1">Jendela ini menutup sendiri. Kalau tidak, tutup saja.</p>
        </div>
      </main>
    );
  }

  return (
    <TempelTabelSppbj
      open
      sebagaiHalaman
      kapalAwal={kapalAwal}
      onAdd={kirim}
      onClose={() => window.close()}
    />
  );
}
