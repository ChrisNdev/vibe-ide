import type { ITheme } from '@xterm/xterm'

// background/cursorAccent match --substrate from styles/tokens.css (xterm needs a literal
// hex, it can't read CSS custom properties). Everything else — foreground, cursor, and the
// 16 ANSI slots — carries shell-output meaning (git status colors, ls --color, etc.) and is
// intentionally left alone: the WebGL terminal renderer is protected by INVARIANTES.
export const xtermTheme: ITheme = {
  background: '#1c1c1e',
  foreground: '#c4c4cc',
  cursor: '#0a84ff',
  cursorAccent: '#1c1c1e',
  selectionBackground: 'rgba(10, 132, 255, 0.25)',
  black: '#18181c',
  red: '#e5484d',
  green: '#39d98a',
  yellow: '#f5a623',
  blue: '#5b9dff',
  magenta: '#c792ea',
  cyan: '#5cf0d0',
  white: '#c4c4cc',
  brightBlack: '#4a4a54',
  brightRed: '#ff6b70',
  brightGreen: '#5cf0a5',
  brightYellow: '#ffc14d',
  brightBlue: '#82b6ff',
  brightMagenta: '#e0b3ff',
  brightCyan: '#8ff5e0',
  brightWhite: '#e8e8ec'
}
