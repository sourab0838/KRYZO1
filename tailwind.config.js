/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B0B0B',
          900: '#111111',
          850: '#161616',
          800: '#1C1C1C',
          700: '#242424',
          600: '#2E2E2E',
          500: '#3A3A3A',
        },
        gold: {
          50: '#FBF6E3',
          100: '#F7ECC1',
          200: '#EFD983',
          300: '#E4C44A',
          400: '#D4AF37',
          500: '#B8962B',
          600: '#9A7B22',
          700: '#7A611B',
          800: '#5C4814',
          900: '#3D300E',
        },
        success: {
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        },
        warning: {
          400: '#FBBF24',
          500: '#F59E0B',
        },
        error: {
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
        },
        info: {
          400: '#60A5FA',
          500: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Sora', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(212,175,55,0.25), 0 8px 30px rgba(212,175,55,0.12)',
        glass: '0 8px 32px rgba(0,0,0,0.45)',
        'glass-gold': '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.18)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #E4C44A 50%, #B8962B 100%)',
        'gold-shimmer': 'linear-gradient(110deg, #B8962B 0%, #D4AF37 25%, #F7ECC1 50%, #D4AF37 75%, #B8962B 100%)',
        'ink-radial': 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #0B0B0B 60%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212,175,55,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(212,175,55,0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        'fade-in': 'fade-in 0.5s ease-out both',
        'scale-in': 'scale-in 0.4s ease-out both',
        shimmer: 'shimmer 3s linear infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
