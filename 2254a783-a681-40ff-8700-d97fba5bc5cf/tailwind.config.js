/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        'port-bg': '#0a1628',
        'port-panel': '#1e3a5f',
        'port-card': '#152238',
        'port-accent': '#2979ff',
        'port-success': '#00c853',
        'port-warning': '#ff8c00',
        'port-danger': '#ff3d00',
        'port-text': '#e8eaf6',
        'port-text-muted': '#90a4ae'
      }
    }
  },
  plugins: []
}
