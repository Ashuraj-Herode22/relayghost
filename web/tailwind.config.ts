import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        scada: {
          dark: "#0b0f17",
          panel: "#111827",
          border: "#1f2937",
          accent: "#10b981",
          hazard: "#ef4444",
          laser: "#ff0055",
          wire: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
