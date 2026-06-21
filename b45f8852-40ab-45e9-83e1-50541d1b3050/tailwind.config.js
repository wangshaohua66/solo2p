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
        dispatch: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#1E3A8A",
          800: "#1E3A8A",
          900: "#172554",
          950: "#0E1A3D",
        },
        outage: {
          primary: "#DC2626",
          secondary: "#2563EB",
          corridor: "#16A34A",
          reform: "#D97706",
        },
        conflict: {
          critical: "#EF4444",
          warning: "#F59E0B",
          info: "#3B82F6",
        },
      },
      fontFamily: {
        sans: [
          "Noto Sans SC",
          "PingFang SC",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.06)",
        "card-hover":
          "0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.06)",
        glow: "0 0 16px rgba(99, 102, 241, 0.35)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-right": "slideRight 0.3s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        ripple: "ripple 0.6s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        ripple: {
          "0%": { transform: "scale(0.8)", opacity: "0.8" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
