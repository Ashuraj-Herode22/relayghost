import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      colors: {
        obsidian: {
          950: "#06070A", // Canvas
          900: "#0C0E14", // Primary Card
          850: "#10131B",
          800: "#131722", // Interactive Surface / Hover
          700: "#1E2433", // Hairline Border Highlight
        },
        spectral: {
          amber: "#F59E0B",
          emerald: "#10B981",
          violet: "#8B5CF6",
          crimson: "#EF4444",
          cyan: "#06B6D4",
        },
      },
    },
  },
  plugins: [],
};
export default config;
