import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Support levels used throughout the diagnostic UI (see spec §34).
        support: {
          none: "#6b7280",
          low: "#f59e0b",
          moderate: "#3b82f6",
          high: "#10b981",
        },
      },
    },
  },
  plugins: [],
};

export default config;
