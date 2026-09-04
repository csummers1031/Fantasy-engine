import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        desk: {
          bg: "#0b0f14",
          panel: "#111821",
          line: "#1f2a37",
          up: "#22c55e",
          down: "#ef4444",
          warn: "#f59e0b",
          info: "#38bdf8",
        },
        pos: {
          qb: "#f472b6",
          rb: "#34d399",
          wr: "#60a5fa",
          te: "#fbbf24",
          k: "#a78bfa",
          def: "#94a3b8",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        "pulse-alert": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.6)" },
          "50%": { boxShadow: "0 0 0 6px rgba(239, 68, 68, 0)" },
        },
      },
      animation: {
        "pulse-alert": "pulse-alert 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
