import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ─── COLOR PALETTE ───────────────────────────────────────────────────────
      // Intent: developer-terminal aesthetic, dark-mode default.
      // Base: near-black surfaces with subtle elevation steps.
      // Accent: amber-gold — evokes payment/money, distinctive vs. blue-purple SaaS.
      // Border: low-contrast zinc for structure without heaviness.
      colors: {
        // Surfaces (dark → slightly lighter)
        base: "#0a0a0a",      // page background
        surface: "#111111",   // card / section background
        raised: "#1a1a1a",    // elevated panel / code block
        overlay: "#222222",   // modal / tooltip

        // Borders
        border: "#2a2a2a",    // default border
        borderStrong: "#404040", // emphasized border / divider

        // Text
        ink: "#fafafa",       // primary text
        inkMuted: "#a3a3a3",  // secondary / labels
        inkSubtle: "#525252", // placeholder / disabled

        // Brand accent — amber gold
        accent: {
          DEFAULT: "#f59e0b", // amber-500
          dark: "#d97706",    // amber-600
          light: "#fbbf24",   // amber-400
          glow: "rgba(245,158,11,0.15)", // glow bg
        },

        // Status
        success: "#22c55e",   // verified / confirmed
        danger: "#ef4444",    // error / rejected
      },

      // ─── TYPE SCALE ──────────────────────────────────────────────────────────
      // Fluid sizes used via utility classes; rem-based for accessibility.
      // xs(12) → sm(14) → base(16) → lg(18) → xl(20) → 2xl(24) → 3xl(30) → 4xl(36) → 5xl(48) → 6xl(60) → 7xl(72)
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },

      // ─── ANIMATION ───────────────────────────────────────────────────────────
      animation: {
        "fade-up": "fadeUp 0.5s ease-out forwards",
        "cursor-blink": "cursorBlink 1s step-end infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        cursorBlink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },

      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
    },
  },
  plugins: [],
};

export default config;
