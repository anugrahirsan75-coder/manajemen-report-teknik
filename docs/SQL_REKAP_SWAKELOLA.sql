-- View ringkasan pekerjaan swakelola.
--
-- KENAPA ADA: halaman Rekap Swakelola hanya menampilkan ringkasan, tetapi
-- sebelumnya menarik payload UTUH tiap baris untuk menghitung angkanya di
-- peramban. Payload swakelola memuat fotoDok — foto dokumentasi dalam bentuk
-- base64 — sehingga satu proyek berfoto banyak berukuran 1,6 MB, dan seluruh
-- 1,6 MB itu dikirim ulang setiap kali rekap dibuka, hanya untuk menghasilkan
-- tulisan "12 foto".
--
-- Akibatnya tidak terlihat dari layar mana pun: kuota Fast Origin Transfer
-- Vercel (10 GB/bulan) habis pada 24 September 2026 dan seluruh situs dipause.
--
-- Dengan view ini jumlahnya dihitung di basis data, dan yang menyeberang
-- tinggal beberapa ratus byte per baris.
--
-- CARA PAKAI: buka Supabase -> SQL Editor -> tempel seluruh isi berkas ini ->
-- Run. Aplikasi memakainya otomatis; selama view belum ada, aplikasi tetap
-- memakai jalur lama sehingga tidak ada yang rusak sebelum SQL ini dijalankan.

create or replace view public.rekap_swakelola as
select
  p.id,
  coalesce(nullif(p.payload->>'namaKapal', ''), p.nama_kapal)            as nama_kapal,
  coalesce((p.payload->>'tahun')::int, p.tahun)                          as tahun,
  coalesce(p.payload->>'nomorSpk', '')                                   as nomor_spk,
  -- nilai swakelola: biayaPekerjaan bila ada, selain itu dari blok distribusi
  coalesce(
    nullif(p.payload->>'biayaPekerjaan', '')::numeric,
    nullif(p.payload#>>'{distribusi,nilaiSwakelola}', '')::numeric,
    0
  )                                                                      as nilai,
  coalesce(p.payload->>'tanggalMulai', '')                               as tanggal_mulai,
  coalesce(p.payload->>'tanggalSelesai', '')                             as tanggal_selesai,
  -- jsonb_array_length hanya sah untuk array; kunci yang hilang atau bertipe
  -- lain dijadikan 0 supaya satu baris rusak tidak menggagalkan seluruh view
  case when jsonb_typeof(p.payload->'crew') = 'array'
       then jsonb_array_length(p.payload->'crew') else 0 end              as jml_crew,
  (case when jsonb_typeof(p.payload->'pekerjaanDeck') = 'array'
        then jsonb_array_length(p.payload->'pekerjaanDeck') else 0 end)
  + (case when jsonb_typeof(p.payload->'pekerjaanMesin') = 'array'
          then jsonb_array_length(p.payload->'pekerjaanMesin') else 0 end) as jml_pekerjaan,
  case when jsonb_typeof(p.payload->'fotoDok') = 'array'
       then jsonb_array_length(p.payload->'fotoDok') else 0 end           as jml_foto,
  p.created_at
from public.projects p
where p.payload->>'kind' is null;

-- View mewarisi hak akses tabel asalnya lewat security_invoker, jadi aturan
-- RLS pada projects tetap berlaku dan view ini tidak menjadi jalan pintas.
alter view public.rekap_swakelola set (security_invoker = on);

grant select on public.rekap_swakelola to anon, authenticated;

-- Memeriksa hasilnya:
--   select * from public.rekap_swakelola order by created_at desc limit 5;
