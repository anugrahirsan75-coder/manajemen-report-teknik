/**
 * Sambungan basis data untuk route Lapor Kapal.
 * Isinya kini satu pintu dengan route server lain — lihat src/lib/dbServer.ts.
 */
export { dbServer as dbLapor, dbSiap } from "@/lib/dbServer";
