import { extname } from './pathUtils'

/**
 * Two-letter (occasionally three/four) monospace type tag, replacing colored
 * per-extension icons — SISTEMA DE DESIGN → Densidade e detalhe.
 */
export default function FileTypeTag({ name }: { name: string }): JSX.Element {
  const ext = extname(name)
  const label = ext ? ext.slice(0, 4).toUpperCase() : '—'
  return (
    <span className="w-6 shrink-0 text-center font-mono text-[9px] leading-none text-muted">
      {label}
    </span>
  )
}
