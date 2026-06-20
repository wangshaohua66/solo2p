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
          DEFAULT: "#1a1a2e",
          primary: "#1a1a2e",
          secondary: "#16213e",
          tertiary: "#0f3460",
        },
        accent: {
          DEFAULT: "#e94560",
          primary: "#e94560",
          secondary: "#4facfe",
          hover: "#ff5670",
          soft: "rgba(233,69,96,0.15)",
        },
        waveform: {
          bar: "#4facfe",
          peak: "#00f2fe",
          selection: "rgba(233,69,96,0.3)",
        },
        success: {
          DEFAULT: "#06d6a0",
          soft: "rgba(6,214,160,0.15)",
        },
        warning: {
          DEFAULT: "#ffd166",
          soft: "rgba(255,209,102,0.15)",
        },
        info: {
          DEFAULT: "#3b82f6",
          soft: "rgba(59,130,246,0.15)",
        },
        danger: {
          DEFAULT: "#ef4444",
          soft: "rgba(239,68,68,0.15)",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          hover: "rgba(255,255,255,0.16)",
          subtle: "rgba(255,255,255,0.06)",
        },
        text: {
          DEFAULT: "#ffffff",
          primary: "#ffffff",
          muted: "rgba(255,255,255,0.55)",
          secondary: "rgba(255,255,255,0.8)",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        sans: ["Noto Sans SC", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-accent": "0 0 20px rgba(233,69,96,0.4)",
        "glow-accent-20": "0 0 20px rgba(233,69,96,0.2)",
        "glow-accent-30": "0 0 20px rgba(233,69,96,0.3)",
        "glow-accent-40": "0 0 20px rgba(233,69,96,0.4)",
        "glow-wave": "0 0 12px rgba(79,172,254,0.3)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.25s ease-out",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
