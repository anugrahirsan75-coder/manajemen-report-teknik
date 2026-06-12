"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useServis } from "@/lib/servis/store";
import { ServisItem, ServisStatus, SERVIS_STATUS_LABEL, JENIS_BARANG, newServisItem, lamaHari } from "@/lib/servis/types";
import { KAPAL_LIST_NONPR, VENDOR_NONPR } from "@/lib/nonpr/db";
import { Field, Input, Section } from "@/components/Field";

// kompres foto (canvas, maks 1024px, jpeg 0.72) biar payload Supabase kecil
async function compress(file: File, maxDim = 1024, q = 0.72): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
}

export default function ServisIsi() {
  const { editing, setEditing, saveItem, deleteItem } = useServis();
  const router = useRouter();
  const [it, setIt] = useState<ServisItem>(() => editing ?? newServisItem());
  const [saving, setSaving] = useState(false);
  const isEdit = !!editing?.createdAt;

  useEffect(() => { if (editing) setIt(editing); }, [editing]);

  const set = (patch: Partial<ServisItem>) => setIt((p) => ({ ...p, ...patch }));

  const setStatus = (s: ServisStatus) => {
    const patch: Partial<ServisItem> = { status: s };
    if (s === "kembali" && !it.tanggalKembali) patch.tanggalKembali = new Date().toISOString().slice(0, 10);
    set(patch);
  };

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const urls = await Promise.all(files.map((f) => compress(f)));
    set({ foto: [...(it.foto || []), ...urls].slice(0, 3) });
    e.target.value = "";
  };

  const simpan = async () => {
    if (!it.namaBarang.trim()) { alert("Nama barang wajib diisi."); return; }
    if (!it.kapal.trim()) { alert("Kapal wajib diisi."); return; }
    setSaving(true);
    try { await saveItem(it); setEditing(null); router.push("/servis"); }
    finally { setSaving(false); }
  };

  const hapus = async () => {
    if (!confirm(`Hapus "${it.namaBarang}"?`)) return;
    await deleteItem(it.id); setEditing(null); router.push("/servis");
  };

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="glass rounded-2xl ring-line elev-md px-5 py-4 mb-6 sticky top-3 z-20 flex items-center justify-between gap-3">
        <div>
          <Link href="/servis" className="text-xs text-slate-500 hover:text-[#16357f]">‹ Monitoring Servis</Link>
          <h1 className="text-xl font-extrabold asdp-text-gradient">{isEdit ? "Edit Barang Servis" : "Input Barang Servis"}</h1>
          {isEdit && <p className="text-xs text-slate-500">{lamaHari(it)} hari di bengkel</p>}
        </div>
        <div className="flex gap-2">
          {isEdit && <button onClick={hapus} className="text-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-lg">Hapus</button>}
          <button onClick={simpan} disabled={saving} className="asdp-gradient text-white text-sm font-semibold px-5 py-1.5 rounded-lg shadow disabled:opacity-60">
            {saving ? "Menyimpan…" : "💾 Simpan"}
          </button>
        </div>
      </div>

      <Section title="Data Barang" icon="⚙️">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nama Barang *"><Input value={it.namaBarang} onChange={(e) => set({ namaBarang: e.target.value })} placeholder="Alternator AE Kanan" /></Field>
          <Field label="Jenis">
            <Input list="jenisList" value={it.jenis} onChange={(e) => set({ jenis: e.target.value })} placeholder="Alternator / Pompa / …" />
            <datalist id="jenisList">{JENIS_BARANG.map((j) => <option key={j} value={j} />)}</datalist>
          </Field>
          <Field label="Kapal *">
            <Input list="kapalListServis" value={it.kapal} onChange={(e) => set({ kapal: e.target.value })} />
            <datalist id="kapalListServis">{KAPAL_LIST_NONPR.map((k) => <option key={k} value={k} />)}</datalist>
          </Field>
          <Field label="Bengkel / Vendor">
            <Input list="bengkelList" value={it.bengkel} onChange={(e) => set({ bengkel: e.target.value })} placeholder="nama bengkel" />
            <datalist id="bengkelList">{VENDOR_NONPR.map((v) => <option key={v.nama} value={v.nama} />)}</datalist>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Kerusakan / Keluhan">
            <textarea rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={it.kerusakan}
              onChange={(e) => set({ kerusakan: e.target.value })} placeholder="mis. tidak mengisi, bearing kasar…" />
          </Field>
        </div>
      </Section>

      <Section title="Tanggal & Status" icon="📅">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Tanggal Kirim *"><Input type="date" value={it.tanggalKirim} onChange={(e) => set({ tanggalKirim: e.target.value })} /></Field>
          <Field label="Estimasi Selesai"><Input type="date" value={it.tanggalEstimasi || ""} onChange={(e) => set({ tanggalEstimasi: e.target.value })} /></Field>
          <Field label="Tanggal Kembali"><Input type="date" value={it.tanggalKembali || ""} onChange={(e) => set({ tanggalKembali: e.target.value })} /></Field>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600 mb-1.5">Status</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SERVIS_STATUS_LABEL) as ServisStatus[]).map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${it.status === s ? "asdp-gradient text-white border-transparent shadow" : "text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                {SERVIS_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Field label="Biaya Perbaikan (Rp)"><Input type="number" value={it.biaya ?? ""} onChange={(e) => set({ biaya: e.target.value ? +e.target.value : undefined })} placeholder="0" /></Field>
          <Field label="Catatan">
            <Input value={it.catatan || ""} onChange={(e) => set({ catatan: e.target.value })} placeholder="catatan tambahan…" />
          </Field>
        </div>
      </Section>

      <Section title="Dokumentasi (Foto, maks 3)" icon="📷">
        <input type="file" accept="image/*" multiple onChange={onFoto} className="text-sm" />
        <p className="text-[11px] text-slate-400 mt-1">Foto otomatis dikompres (maks 1024px) biar hemat penyimpanan.</p>
        {!!it.foto?.length && (
          <div className="flex gap-3 mt-3 flex-wrap">
            {it.foto.map((u, i) => (
              <div key={i} className="relative">
                <img src={u} alt={`foto ${i + 1}`} className="h-28 w-36 object-cover rounded-lg border" />
                <button onClick={() => set({ foto: it.foto!.filter((_, fi) => fi !== i) })} title="Hapus foto"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold shadow grid place-items-center hover:bg-red-600">✕</button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </main>
  );
}
