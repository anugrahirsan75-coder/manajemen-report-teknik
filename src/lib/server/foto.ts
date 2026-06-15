// Helper server: foto bisa berupa data URL base64 (lama) ATAU URL http (Supabase Storage).
// Untuk embed ke Excel butuh buffer + ekstensi.

export async function resolveFotoBuffer(value: string): Promise<{ buf: Buffer; ext: "jpeg" | "png" | "gif" } | null> {
  if (!value) return null;
  const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(value);
  if (m) {
    const ext = (/jpe?g/i.test(m[1]) ? "jpeg" : m[1].toLowerCase()) as "jpeg" | "png" | "gif";
    return { buf: Buffer.from(m[2], "base64"), ext };
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const r = await fetch(value, { cache: "no-store" });
      if (!r.ok) return null;
      const ct = r.headers.get("content-type") || "";
      const ext = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" : "jpeg";
      return { buf: Buffer.from(await r.arrayBuffer()), ext };
    } catch { return null; }
  }
  return null;
}

// untuk pipeline raw-XML (nonpr) yang butuh data URL: konversi URL http -> data URL base64.
export async function fotoToDataUrl(value: string): Promise<string> {
  if (!value || value.startsWith("data:")) return value;
  const r = await resolveFotoBuffer(value);
  if (!r) return "";
  return `data:image/${r.ext};base64,${r.buf.toString("base64")}`;
}
