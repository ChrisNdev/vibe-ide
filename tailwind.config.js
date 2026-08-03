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
        warn: '#f5a623',

        // Sistema de design CMYK (docs/PLANO.md → SISTEMA DE DESIGN), lido de src/renderer/src/styles/tokens.css
        substrate: 'var(--substrate)',
        panel: 'var(--panel)',
        rule: 'var(--rule)',
        paper: 'var(--paper)',
        muted: 'var(--muted)',
        ink: {
          cyan: 'var(--ink-cyan)',
          magenta: 'var(--ink-magenta)',
          yellow: 'var(--ink-yellow)',
          overprint: 'var(--ink-overprint)'
        }
      },
      fontFamily: {
        mono: ['"Commit Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Archivo Expanded"', 'Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      transitionDuration: {
        150: '150ms'
      },
      // Regra dura do sistema de design: zero box-shadow, profundidade é degrau de valor + fio de 1px.
      boxShadow: {
        panel: 'none',
        popover: 'none'
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '3px',
        md: '3px'
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
