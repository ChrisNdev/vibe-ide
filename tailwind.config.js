/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral grays modeled on macOS dark-mode system colors (true gray, no tint).
        base: {
          950: '#1c1c1e',
          900: '#202022',
          850: '#242426',
          800: '#2c2c2e',
          750: '#323234',
          700: '#3a3a3c',
          600: '#48484a',
          500: '#636366',
          400: '#8e8e93',
          300: '#aeaeb2',
          200: '#c7c7cc',
          100: '#f5f5f7'
        },
        accent: {
          DEFAULT: '#0a84ff',
          dim: '#0968cc',
          bright: '#409cff',
          muted: 'rgba(10, 132, 255, 0.15)'
        },
        danger: '#ff453a',
        warn: '#ff9f0a',

        // Surface/text aliases — read from src/renderer/src/styles/tokens.css.
        substrate: 'var(--substrate)',
        panel: 'var(--panel)',
        rule: 'var(--rule)',
        paper: 'var(--paper)',
        muted: 'var(--muted)',
        // Semantic accents (agent touched / dirty / warning / both) — same names kept everywhere
        // they're already wired, values now map to Apple's system color palette.
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
      transitionTimingFunction: {
        // "ease-out-expo"-ish — the fluid, fast-then-settle deceleration used across macOS/iOS UI.
        apple: 'cubic-bezier(0.16, 1, 0.3, 1)'
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        md: '12px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px'
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(8px) scale(0.98)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } }
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 260ms cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }
  },
  plugins: []
}
