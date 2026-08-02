const isWindowsPath = (p: string): boolean => p.includes('\\')

export function dirname(p: string): string {
  const sep = isWindowsPath(p) ? '\\' : '/'
  const trimmed = p.endsWith(sep) ? p.slice(0, -1) : p
  const idx = trimmed.lastIndexOf(sep)
  if (idx <= 0) return trimmed.slice(0, idx + 1) || trimmed
  return trimmed.slice(0, idx)
}

export function basename(p: string): string {
  const sep = isWindowsPath(p) ? '\\' : '/'
  const trimmed = p.endsWith(sep) ? p.slice(0, -1) : p
  const idx = trimmed.lastIndexOf(sep)
  return idx === -1 ? trimmed : trimmed.slice(idx + 1)
}

export function join(dir: string, name: string): string {
  const sep = isWindowsPath(dir) ? '\\' : '/'
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`
}

export function extname(name: string): string {
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return ''
  return name.slice(idx + 1).toLowerCase()
}

export function isDescendantOrSelf(root: string, target: string): boolean {
  if (target === root) return true
  const sep = isWindowsPath(root) ? '\\' : '/'
  return target.startsWith(root.endsWith(sep) ? root : root + sep)
}
