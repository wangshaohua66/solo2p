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
        'bio-bg': '#0d1117',
        'bio-panel': '#161b22',
        'bio-border': '#30363d',
        'bio-text': '#c9d1d9',
        'bio-text-secondary': '#8b949e',
        'bio-blue': '#58a6ff',
        'bio-orange': '#f0883e',
        'bio-red': '#ff7b72',
        'bio-green': '#3fb950',
        'bio-yellow': '#d29922',
        'base-a': '#3fb950',
        'base-t': '#f85149',
        'base-c': '#58a6ff',
        'base-g': '#d29922',
        'mut-pathogenic': '#ff00aa',
        'mut-likely-pathogenic': '#ff7b00',
        'mut-benign': '#00ffcc',
        'mut-uncertain': '#a371f7',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-blue': '0 0 8px rgba(88, 166, 255, 0.4)',
        'glow-magenta': '0 0 8px rgba(255, 0, 170, 0.4)',
        'glow-orange': '0 0 8px rgba(255, 123, 0, 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
