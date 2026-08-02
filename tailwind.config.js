/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0a0a0c',
          900: '#0d0d0f',
          850: '#121215',
          800: '#18181c',
          750: '#1e1e23',
          700: '#26262c',
          600: '#35353d',
          500: '#4a4a54',
          400: '#6b6b76',
          300: '#9a9aa4',
          200: '#c4c4cc',
          100: '#e8e8ec'
        },
        accent: {
          DEFAULT: '#39d98a',
          dim: '#2ba86b',
          bright: '#5cf0a5',
          muted: 'rgba(57, 217, 138, 0.12)'
        },
        danger: '#e5484d',
        warn: '#f5a623'
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      transitionDuration: {
        150: '150ms'
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(255,255,255,0.04)',
        popover: '0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)'
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } }
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 150ms ease-out'
      }
    }
  },
  plugins: []
}
