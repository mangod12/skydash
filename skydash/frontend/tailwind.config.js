/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zinc: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        brand: '#6366f1',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.glass': {
          'backdrop-filter': 'blur(16px)',
          '-webkit-backdrop-filter': 'blur(16px)',
          'background-color': 'rgba(9, 9, 11, 0.55)',
          'border': '1px solid rgba(255, 255, 255, 0.08)',
        },
        '.glass-elevated': {
          'backdrop-filter': 'blur(20px)',
          '-webkit-backdrop-filter': 'blur(20px)',
          'background-color': 'rgba(9, 9, 11, 0.7)',
          'border': '1px solid rgba(255, 255, 255, 0.1)',
          'border-top-color': 'rgba(255, 255, 255, 0.14)',
          'box-shadow': 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 32px rgba(0, 0, 0, 0.4)',
        },
        '.tabular-nums': {
          'font-variant-numeric': 'tabular-nums slashed-zero',
          'font-feature-settings': "'tnum', 'zero'",
        },
        '.text-glow-cyan': {
          'text-shadow': '0 0 10px rgba(34, 211, 238, 0.5), 0 0 30px rgba(34, 211, 238, 0.2)',
        },
        '.text-glow-red': {
          'text-shadow': '0 0 10px rgba(239, 68, 68, 0.5), 0 0 30px rgba(239, 68, 68, 0.2)',
        },
        '.text-glow-amber': {
          'text-shadow': '0 0 10px rgba(245, 158, 11, 0.5), 0 0 30px rgba(245, 158, 11, 0.2)',
        },
        '.text-glow-indigo': {
          'text-shadow': '0 0 10px rgba(99, 102, 241, 0.5), 0 0 30px rgba(99, 102, 241, 0.2)',
        },
      })
    },
  ],
}
