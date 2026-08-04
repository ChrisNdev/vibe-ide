import { useEffect, useMemo, useRef, useState } from 'react'
import { useExplorerStore } from '@renderer/store/explorerStore'
import { basename, dirname } from '@renderer/components/Explorer/pathUtils'
import { fuzzyMatch } from './fuzzyMatch'

interface QuickOpenProps {
  onClose: () => void
  onOpenResult: (file: string) => void
}

const MAX_SHOWN = 200

function HighlightedLabel({ text, indices }: { text: string; indices: number[] }): JSX.Element {
  const set = useMemo(() => new Set(indices), [indices])
  return (
    <>
      {[...text].map((ch, i) => (
        <span key={i} className={set.has(i) ? 'text-ink-yellow' : undefined}>
          {ch}
        </span>
      ))}
    </>
  )
}

export default function QuickOpen({ onClose, onOpenResult }: QuickOpenProps): JSX.Element {
  const rootPath = useExplorerStore((s) => s.rootPath)
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    if (!rootPath) return
    let cancelled = false
    setLoading(true)
    window.api.search.listFiles(rootPath).then((files) => {
      if (!cancelled) {
        setAllFiles(files)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [rootPath])

  const results = useMemo(() => {
    if (!query.trim()) return allFiles.slice(0, MAX_SHOWN).map((file) => ({ file, indices: [] as number[] }))
    const scored: { file: string; score: number; indices: number[] }[] = []
    for (const file of allFiles) {
      const name = basename(file)
      const match = fuzzyMatch(query, name) ?? fuzzyMatch(query, file)
      if (match) scored.push({ file, score: match.score, indices: match.indices })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, MAX_SHOWN)
  }, [query, allFiles])

  useEffect(() => setSelected(0), [query])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      const pick = results[selected]
      if (pick) onOpenResult(pick.file)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-substrate/50 pt-24 backdrop-blur-sm" onClick={onClose}>
      <div
        className="surface flex max-h-[60vh] w-[560px] flex-col overflow-hidden rounded-2xl border border-base-700/60 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ir para arquivo…"
          className="border-b border-base-700/60 bg-transparent px-3.5 py-3 text-[13px] text-base-100 outline-none placeholder:text-base-500"
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && <div className="p-3 text-[12px] text-base-500">Lendo arquivos do projeto…</div>}
          {!loading && results.length === 0 && <div className="p-3 text-[12px] text-base-500">Nada encontrado.</div>}
          {!loading &&
            results.map((r, i) => (
              <button
                key={r.file}
                onClick={() => onOpenResult(r.file)}
                onMouseEnter={() => setSelected(i)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] ${i === selected ? 'bg-accent-muted' : 'hover:bg-base-800/70'}`}
              >
                <span className="truncate font-mono text-base-100">
                  <HighlightedLabel text={basename(r.file)} indices={r.indices} />
                </span>
                <span className="truncate text-base-500">{dirname(r.file).replace(rootPath ?? '', '') || '/'}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
