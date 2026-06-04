"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { MaterialRequest, MaterialItem, emptyItem } from "./types";

const LS_KEY = "material_request";

function defaultRequest(): MaterialRequest {
  const today = new Date().toISOString().slice(0, 10);
  return {
    tanggal: today,
    noPenawaran: String(Math.floor(100 + Math.random() * 900)),
    deptHead: "Eryanto Sidabalok",
    stafTeknik: "Irsan Anugrah",
    judulFormulir: "Pengadaan SC dan Perlengkapan Kapal",
    judulSC: "Pengadaan Suku Cadang Kapal",
    judulUmum: "Pengadaan Barang Umum Kapal",
    items: [
      { ...emptyItem("SEMUA KAPAL"), nama: "Safety Helmet", kode: "B03009", satuan: "PC", qty: 5, harga: 150000 },
      { ...emptyItem("KMP. GORANGO"), partNumber: "148616-48200", nama: "THERMOSTAT, 71C54", kode: "B02007", satuan: "PC", qty: 2, harga: 2500000 },
    ],
  };
}

interface Ctx {
  req: MaterialRequest;
  setReq: (r: MaterialRequest) => void;
  update: (patch: Partial<MaterialRequest>) => void;
  setItem: (id: string, patch: Partial<MaterialItem>) => void;
  addItem: (kapal?: string) => void;
  delItem: (id: string) => void;
}

const C = createContext<Ctx | null>(null);

export function MaterialProvider({ children }: { children: React.ReactNode }) {
  const [req, setReqState] = useState<MaterialRequest>(defaultRequest);

  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setReqState({ ...defaultRequest(), ...JSON.parse(raw) }); } catch {}
  }, []);

  const persist = (r: MaterialRequest) => { try { localStorage.setItem(LS_KEY, JSON.stringify(r)); } catch {} };
  const setReq = (r: MaterialRequest) => { setReqState(r); persist(r); };
  const update = (patch: Partial<MaterialRequest>) => setReqState((p) => { const n = { ...p, ...patch }; persist(n); return n; });
  const setItem = (id: string, patch: Partial<MaterialItem>) =>
    setReqState((p) => { const n = { ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }; persist(n); return n; });
  const addItem = (kapal = "SEMUA KAPAL") =>
    setReqState((p) => { const n = { ...p, items: [...p.items, emptyItem(kapal)] }; persist(n); return n; });
  const delItem = (id: string) =>
    setReqState((p) => { const n = { ...p, items: p.items.filter((it) => it.id !== id) }; persist(n); return n; });

  return <C.Provider value={{ req, setReq, update, setItem, addItem, delItem }}>{children}</C.Provider>;
}

export function useMaterial() {
  const c = useContext(C);
  if (!c) throw new Error("useMaterial harus di dalam MaterialProvider");
  return c;
}
