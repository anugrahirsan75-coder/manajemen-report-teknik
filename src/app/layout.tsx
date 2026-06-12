import "./globals.css";
import type { Metadata } from "next";
import { StoreProvider } from "@/lib/store";
import { MaterialProvider } from "@/lib/material/store";
import { SppbjProvider } from "@/lib/sppbj/store";
import { NonprProvider } from "@/lib/nonpr/store";
import { ServisProvider } from "@/lib/servis/store";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Otomatisasi Dokumen Teknik ASDP",
  description: "Platform otomatisasi dokumen teknik PT. ASDP Indonesia Ferry",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body>
        <StoreProvider>
          <MaterialProvider>
            <SppbjProvider>
              <NonprProvider>
                <ServisProvider>
                  <div className="md:flex min-h-screen">
                    <Sidebar />
                    <div className="flex-1 min-w-0">{children}</div>
                  </div>
                </ServisProvider>
              </NonprProvider>
            </SppbjProvider>
          </MaterialProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
