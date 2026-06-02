import "./globals.css";
import type { Metadata } from "next";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Generator Swakelola Docking — ASDP",
  description: "Generator dokumen swakelola docking kapal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
