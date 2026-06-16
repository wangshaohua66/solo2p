/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1e1e2e',
        'sidebar-light': '#313244',
        'sidebar-lighter': '#45475a',
        'sidebar-muted': '#585b70',
        'sidebar-fg': '#6c7086',
        accent: '#7c3aed',
        'accent-hover': '#8b5cf6',
        'accent-dark': '#6d28d9',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        canvas: '#ffffff',
        'checker-1': '#f8f8f8',
        'checker-2': '#e8e8e8',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['"Noto Sans SC"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px rgba(0, 0, 0, 0.25)',
        'card-hover': '0 8px 30px rgba(124, 58, 237, 0.15)',
        toolbar: '0 4px 20px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-right': 'slide-right 0.2s ease-out',
      },
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.8' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
