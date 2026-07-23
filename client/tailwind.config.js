/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdf5',
          100: '#d6f9e6',
          200: '#aff0cf',
          300: '#78e2b1',
          400: '#3fcd8f',
          500: '#16b478',
          600: '#0a9061',
          700: '#0a7350',
          800: '#0c5b41',
          900: '#0b4b37',
        },
        ink: {
          900: '#0a0f14',
          850: '#0f1620',
          800: '#141d29',
          700: '#1c2836',
          600: '#2a3a4d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
