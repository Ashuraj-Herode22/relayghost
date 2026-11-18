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
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Intercept and swallow uncaught errors originating from third-party Chrome extensions
              if (typeof window !== "undefined") {
                window.addEventListener("error", function(e) {
                  if (
                    (e.filename && e.filename.startsWith("chrome-extension://")) ||
                    (e.message && e.message.includes("M_ID")) ||
                    (e.error && e.error.stack && e.error.stack.includes("chrome-extension://"))
                  ) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    return true;
                  }
                }, true);

                window.addEventListener("unhandledrejection", function(e) {
                  var reason = e.reason || {};
                  var stack = reason.stack || String(reason);
                  if (stack.indexOf("chrome-extension://") !== -1 || stack.indexOf("M_ID") !== -1) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                  }
                }, true);
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="antialiased min-h-screen bg-[#06070A] text-slate-100 font-sans selection:bg-amber-500/20 selection:text-amber-200 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
