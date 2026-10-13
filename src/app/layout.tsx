import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ShipShots", template: "%s · ShipShots" },
  description: "App Store & Google Play screenshots and App Store preview videos — generated locally, scriptable by coding agents.",
};

export const viewport: Viewport = { themeColor: "#0a0b10" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#0a0b10] font-sans text-zinc-100 antialiased" suppressHydrationWarning>
        {children}
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
