import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RelayGhost · Autonomous SCADA Safety Verifier",
  description: "Temporal Bounded Model Checker for IEC 61131-3 Ladder Logic. Rolls-Royce EARS Formal Invariant Engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased min-h-screen bg-[#06070A] text-slate-100 font-sans selection:bg-amber-500/20 selection:text-amber-200 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
