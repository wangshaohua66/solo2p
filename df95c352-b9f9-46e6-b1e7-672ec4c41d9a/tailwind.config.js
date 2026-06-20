/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        background: {
          DEFAULT: "#0f0f12",
          soft: "#141418",
          panel: "#1a1a20",
          elevated: "#22222b",
        },
        border: {
          DEFAULT: "#2a2a35",
          muted: "#33333f",
          accent: "#22d3ee33",
        },
        text: {
          primary: "#f5f5f7",
          secondary: "#a1a1aa",
          muted: "#71717a",
        },
        brand: {
          cyan: "#22d3ee",
          orange: "#f97316",
          emerald: "#10b981",
          rose: "#f43f5e",
          violet: "#a78bfa",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "sans-serif"],
        display: ["'Space Grotesk'", "Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(34, 211, 238, 0.15)",
        "glow-strong": "0 0 30px rgba(34, 211, 238, 0.3)",
        "glow-orange": "0 0 20px rgba(249, 115, 22, 0.25)",
        card: "0 4px 20px rgba(0, 0, 0, 0.4)",
        inset: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-right": "slideRight 0.3s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      borderRadius: {
        lg: "10px",
        xl: "14px",
      },
    },
  },
  plugins: [],
};
