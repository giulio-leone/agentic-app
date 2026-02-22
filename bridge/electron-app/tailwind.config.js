/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#1a1a2e', light: '#222244' },
        accent: { DEFAULT: '#6366f1', light: '#818cf8' },
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f59e0b',
      },
    },
  },
  plugins: [],
};
