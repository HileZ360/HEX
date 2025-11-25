/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hex: {
          bg: '#F9F7F5', // Slightly lighter, cleaner cream
          surface: '#FFFFFF',
          primary: '#7C3AED', // Keep brand purple
          secondary: '#DDD6FE', // Softer secondary
          dark: '#1A1A1A', // Softer black
          gray: '#666666', // Neutral gray
          light: '#F3F4F6',
          accent: '#F5F3FF', // Very light purple for backgrounds
        }
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 8px 30px -4px rgba(0, 0, 0, 0.04)',
        'card': '0 20px 40px -8px rgba(0, 0, 0, 0.06)',
        'glow': '0 0 20px rgba(124, 58, 237, 0.15)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '2.5rem',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
