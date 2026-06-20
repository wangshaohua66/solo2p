/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'funeral': {
          'deepest': '#1A1A1F',
          'dark': '#24242B',
          'card': '#2E2E36',
          'border': '#3A3A44',
          'gold': '#C9A86C',
          'gold-dark': '#8B7355',
          'gold-light': '#D4B87C',
          'text-primary': '#FFFFFF',
          'text-secondary': '#B0B0B8',
          'text-muted': '#6B6B74'
        },
        'status': {
          'success': '#52C41A',
          'warning': '#FA8C16',
          'error': '#FF4D4F',
          'info': '#1890FF'
        }
      },
      fontFamily: {
        'sans': ['"Source Han Sans CN"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        'serif': ['"Source Han Serif CN"', '"Noto Serif SC"', 'Georgia', 'serif'],
        'display': ['"SF Pro Display"', '"PingFang SC"', 'system-ui', 'sans-serif']
      },
      spacing: {
        'sidebar': '240px',
        'sidebar-collapsed': '80px'
      },
      boxShadow: {
        'card': '0 4px 16px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 32px rgba(201, 168, 108, 0.15)',
        'glow-gold': '0 0 20px rgba(201, 168, 108, 0.3)'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideInLeft 0.3s ease-out',
        'float': 'float 6s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      }
    }
  },
  plugins: []
}
