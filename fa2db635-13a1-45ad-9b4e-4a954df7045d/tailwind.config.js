/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wine: {
          50: '#faf5f8',
          100: '#f3e6ee',
          200: '#e6c8d8',
          300: '#d29cba',
          400: '#b96f97',
          500: '#9c4d76',
          600: '#7a3a5c',
          700: '#5b2a4e',
          800: '#451f3c',
          900: '#2f1530',
        },
        gold: {
          50: '#fbf6ec',
          100: '#f5ead0',
          200: '#ecd49c',
          300: '#ddbd6f',
          400: '#c9a86a',
          500: '#b8914a',
          600: '#99763a',
          700: '#7a5c30',
          800: '#5e4626',
          900: '#473520',
        },
        cream: '#FBF8F3',
        ink: '#2b1f26',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', '"Noto Serif SC"', 'serif'],
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        num: ['"Sora"', '"Noto Sans SC"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(43,31,38,0.04), 0 8px 24px -12px rgba(91,42,78,0.12)',
        soft: '0 2px 12px -4px rgba(91,42,78,0.10)',
        lift: '0 18px 40px -16px rgba(91,42,78,0.30)',
      },
      backgroundImage: {
        'wine-grad': 'linear-gradient(135deg, #6b3553 0%, #5b2a4e 55%, #451f3c 100%)',
        'gold-grad': 'linear-gradient(135deg, #d9bd7e 0%, #c9a86a 100%)',
        'grain': "radial-gradient(rgba(91,42,78,0.025) 1px, transparent 1px)",
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        rise: 'rise .5s cubic-bezier(.22,.61,.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
