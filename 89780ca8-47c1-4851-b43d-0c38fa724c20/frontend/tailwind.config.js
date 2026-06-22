/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,vue}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        'bg-deep': '#0a0e27',
        'bg-mid': '#1a1f4e',
        'bg-card': '#12162e',
        'gold': '#d4a853',
        'gold-light': '#f0d78c',
        'gold-dark': '#b8922f',
        'green-up': '#00d4aa',
        'red-down': '#ff4757',
        'text-primary': '#e8e8f0',
        'text-secondary': '#8b8fa3',
        'text-muted': '#5a5e78',
        'border-custom': '#1e2348',
      },
    },
  },
  plugins: [],
};
