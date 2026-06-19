/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          900: '#0F172A',
          850: '#151F35',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          100: '#F1F5F9',
          50: '#F8FAFC'
        },
        brand: {
          500: '#6366F1',
          400: '#818CF8',
          300: '#A5B4FC'
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        accent: '#EC4899'
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-accent': '0 0 20px rgba(236, 72, 153, 0.3)'
      }
    }
  },
  plugins: []
}
