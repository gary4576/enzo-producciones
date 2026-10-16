/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#071225', 900: '#0A1B33', 800: '#0F2A4D', 700: '#173A69' },
        brand: { DEFAULT: '#1E6FE0', 600: '#1A5FC4', 500: '#2D7FF0', 400: '#4C9BFF' },
        cielo: { DEFAULT: '#38BDF8', 100: '#E0F2FE', 50: '#F0F9FF' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(10,27,51,.05), 0 4px 16px rgba(10,27,51,.06)' },
    },
  },
  plugins: [],
};
