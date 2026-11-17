import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RelayGhost | Autonomous SCADA Safety Verifier",
  description: "Temporal Bounded Model Checker for IEC 61131-3 Ladder Logic. Powered by Kiro Spec-Driven Architecture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#070a10] text-slate-100 scada-grid">
        {children}
      </body>
    </html>
  );
}
