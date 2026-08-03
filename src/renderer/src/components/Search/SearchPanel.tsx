import { useEffect, useMemo, useRef, useState } from 'react'
import { X, CaseSensitive, Regex, GitBranch } from 'lucide-react'
import type { SearchMatch, SearchOptions } from '@shared/types'
import { useExplorerStore } from '@renderer/store/explorerStore'
import { basename, dirname } from '@renderer/components/Explorer/pathUtils'

interface SearchPanelProps {
  onClose: () => void
  onOpenResult: (file: string, line: number) => void
}

const DEBOUNCE_MS = 250

function groupByFile(matches: SearchMatch[]): Map<string, SearchMatch[]> {
  const groups = new Map<string, SearchMatch[]>()
  for (const m of matches) {
    const list = groups.get(m.file)
    if (list) list.push(m)
    else groups.set(m.file, [m])
  }
  return groups
}

export default function SearchPanel({ onClose, onOpenResult }: SearchPanelProps): JSX.Element {
  const rootPath = useExplorerStore((s) => s.rootPath)
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  const [respectGitignore, setRespectGitignore] = useState(true)
  const [includeGlob, setIncludeGlob] = useState('')
  const [excludeGlob, setExcludeGlob] = useState('')
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [searching, setSearching] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const offResult = window.api.search.onResult((batch) => {
      setMatches((prev) => [...prev, ...batch])
    })
    const offDone = window.api.search.onDone(({ total, truncated }) => {
      setSearching(false)
      setSummary(total === 0 ? 'sem resultados' : `${total} ocorrência${total === 1 ? '' : 's'}${truncated ? ' (parcial, refine a busca)' : ''}`)
    })
    return () => {
      offResult()
      offDone()
      void window.api.search.cancel()
    }
  }, [])

  const opts: SearchOptions = useMemo(
    () => ({ query, caseSensitive, regex, respectGitignore, includeGlob, excludeGlob }),
    [query, caseSensitive, regex, respectGitignore, includeGlob, excludeGlob]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!rootPath || !query.trim()) {
      void window.api.search.cancel()
      setMatches([])
      setSummary(null)
      setSearching(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      setMatches([])
      setSummary(null)
      setSearching(true)
      void window.api.search.run(rootPath, opts)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath, opts])

  const groups = useMemo(() => groupByFile(matches), [matches])

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-[400px] flex-col border-l border-rule bg-panel text-base-200 animate-slide-up">
      <div className="flex items-center justify-between border-b border-base-700/60 px-3 py-2">
        <span className="font-medium text-base-100">Buscar no projeto</span>
        <button className="rounded p-1 text-base-400 hover:bg-base-700/60" onClick={onClose} title="Fechar (Esc)">
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 border-b border-base-700/60 p-2">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Buscar…"
            className="flex-1 rounded border border-base-700/60 bg-base-900 px-2 py-1 text-[12px] text-base-100 outline-none focus:border-ink-yellow"
          />
          <button
            title="Diferenciar maiúsculas/minúsculas"
            onClick={() => setCaseSensitive((v) => !v)}
            className={`rounded p-1 ${caseSensitive ? 'bg-ink-magenta text-base-950' : 'text-base-400 hover:bg-base-700/60'}`}
          >
            <CaseSensitive size={14} />
          </button>
          <button
            title="Regex"
            onClick={() => setRegex((v) => !v)}
            className={`rounded p-1 ${regex ? 'bg-ink-magenta text-base-950' : 'text-base-400 hover:bg-base-700/60'}`}
          >
            <Regex size={14} />
          </button>
          <button
            title="Respeitar .gitignore"
            onClick={() => setRespectGitignore((v) => !v)}
            className={`rounded p-1 ${respectGitignore ? 'text-accent' : 'text-base-400 hover:bg-base-700/60'}`}
          >
            <GitBranch size={14} />
          </button>
        </div>
        <div className="flex gap-1">
          <input
            value={includeGlob}
            onChange={(e) => setIncludeGlob(e.target.value)}
            placeholder="incluir (ex: *.ts)"
            className="flex-1 rounded border border-base-700/60 bg-base-900 px-2 py-1 text-[11px] text-base-200 outline-none focus:border-ink-yellow"
          />
          <input
            value={excludeGlob}
            onChange={(e) => setExcludeGlob(e.target.value)}
            placeholder="excluir (ex: *.test.ts)"
            className="flex-1 rounded border border-base-700/60 bg-base-900 px-2 py-1 text-[11px] text-base-200 outline-none focus:border-ink-yellow"
          />
        </div>
        {summary && <span className="tabular-nums text-[11px] text-base-500">{searching ? 'buscando…' : summary}</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!rootPath && <div className="p-3 text-[12px] text-base-500">Abra uma pasta pra buscar.</div>}
        {[...groups.entries()].map(([file, fileMatches]) => (
          <div key={file} className="border-b border-base-800">
            <div className="truncate px-2 py-1 text-[11px] font-medium text-base-400" title={file}>
              {basename(file)} <span className="text-base-600">· {dirname(file).replace(rootPath ?? '', '') || '/'}</span>
              <span className="ml-1 tabular-nums text-base-600">({fileMatches.length})</span>
            </div>
            {fileMatches.map((m, i) => (
              <button
                key={i}
                onClick={() => onOpenResult(m.file, m.line)}
                className="flex w-full items-start gap-2 px-2 py-0.5 text-left hover:bg-base-800/70"
              >
                <span className="w-8 shrink-0 tabular-nums text-right font-mono text-[11px] text-base-600">{m.line}</span>
                <span className="truncate font-mono text-[11px] text-base-300">
                  {m.lineText.slice(0, m.matchStart)}
                  <span className="bg-ink-yellow/25 text-base-100">{m.lineText.slice(m.matchStart, m.matchEnd)}</span>
                  {m.lineText.slice(m.matchEnd)}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
