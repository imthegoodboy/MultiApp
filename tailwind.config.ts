import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        workspace: {
          ink: "#111827",
          muted: "#667085",
          line: "#D7DEE8",
          panel: "#FFFFFF",
          field: "#F5F7FA",
          accent: "#0E8F91",
          accentDark: "#0A6F72"
        }
      },
      boxShadow: {
        panel: "0 8px 22px rgba(31, 41, 55, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
