/** Minimal SGR (color/bold) ANSI parser — common codes only, not a full terminal emulator. */
const FG_COLORS: Record<number, string> = {
  30: '#4a4a54',
  31: '#e5484d',
  32: '#39d98a',
  33: '#f5a623',
  34: '#5b9dff',
  35: '#c792ea',
  36: '#5cf0d0',
  37: '#c4c4cc',
  90: '#6b6b76',
  91: '#ff6b70',
  92: '#5cf0a5',
  93: '#ffc14d',
  94: '#82b6ff',
  95: '#e0b3ff',
  96: '#8ff5e0',
  97: '#e8e8ec'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function ansiToHtml(input: string): string {
  const re = /\x1b\[([0-9;]*)m/g
  let result = ''
  let lastIndex = 0
  let openSpan = false
  let bold = false
  let color: string | null = null

  const closeIfOpen = (): void => {
    if (openSpan) {
      result += '</span>'
      openSpan = false
    }
  }
  const openSpanTag = (): void => {
    closeIfOpen()
    const styles = [color ? `color:${color}` : '', bold ? 'font-weight:600' : ''].filter(Boolean).join(';')
    if (styles) {
      result += `<span style="${styles}">`
      openSpan = true
    }
  }

  let match: RegExpExecArray | null
  while ((match = re.exec(input))) {
    result += escapeHtml(input.slice(lastIndex, match.index))
    lastIndex = re.lastIndex
    const codes = match[1].split(';').filter(Boolean).map(Number)
    if (codes.length === 0) codes.push(0)
    for (const code of codes) {
      if (code === 0) {
        bold = false
        color = null
      } else if (code === 1) {
        bold = true
      } else if (FG_COLORS[code]) {
        color = FG_COLORS[code]
      }
    }
    openSpanTag()
  }
  result += escapeHtml(input.slice(lastIndex))
  closeIfOpen()
  return result
}

/** For error-line extraction where we just need plain text, no markup. */
export function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, '')
}
