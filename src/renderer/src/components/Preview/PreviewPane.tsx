import { useEffect, useMemo, useState } from 'react'
import { FileText, GitCompare, Copy, Eye } from 'lucide-react'
import type { FileReadResult, GitFileStatus } from '@shared/types'
import { useExplorerStore } from '@renderer/store/explorerStore'
import { basename, dirname } from '@renderer/components/Explorer/pathUtils'
import { languageForFile, highlight } from './language'
import { parseDiff } from './diff'
import { estimateTokens, formatTokens, formatSize } from './tokenEstimate'

interface PreviewPaneProps {
  active: boolean
}

type Mode = 'file' | 'diff'

const DIFFABLE = new Set<GitFileStatus>(['modified', 'added', 'deleted', 'renamed', 'staged', 'conflicted'])

export default function PreviewPane({ active }: PreviewPaneProps): JSX.Element {
  const previewPath = useExplorerStore((s) => s.previewPath)
  const rootPath = useExplorerStore((s) => s.rootPath)
  const status = useExplorerStore((s) => (s.previewPath ? s.gitStatus[s.previewPath] : undefined))

  const [result, setResult] = useState<FileReadResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode>('file')
  const [diffText, setDiffText] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMode('file')
    setDiffText(null)
    if (!previewPath) {
      setResult(null)
      return
    }
    let cancelled = false
    setLoading(true)
    window.api.fs
      .readFile(previewPath)
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [previewPath])

  useEffect(() => {
    if (mode !== 'diff' || !previewPath || !rootPath) return
    let cancelled = false
    setDiffLoading(true)
    window.api.git
      .diff(rootPath, previewPath)
      .then((d) => {
        if (!cancelled) setDiffText(d)
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode, previewPath, rootPath])

  const lang = previewPath ? languageForFile(previewPath) : null
  const highlighted = useMemo(
    () => (result && !result.binary && !result.truncated ? highlight(result.content, lang) : ''),
    [result, lang]
  )
  const lineCount = result ? (result.content.length ? result.content.split('\n').length : 0) : 0
  const tokenCount = result ? estimateTokens(result.content) : 0
  const diffLines = useMemo(() => (diffText ? parseDiff(diffText) : []), [diffText])
  const canDiff = status !== undefined && DIFFABLE.has(status)

  const copyContent = (): void => {
    if (!result) return
    void window.api.clipboard.writeText(result.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <div className="flex h-full w-full flex-col" style={{ display: active ? 'flex' : 'none' }}>
      <div className="flex items-center gap-2 border-b border-base-700/60 px-3 py-1.5 text-xs text-base-300">
        <Eye size={13} className="text-accent" />
        <span className="font-medium text-base-200">Visualizador local</span>
        {previewPath && (
          <span className="truncate text-base-400" title={previewPath}>
            {basename(previewPath)}
            <span className="text-base-500"> · {dirname(previewPath).replace(rootPath ?? '', '') || '/'}</span>
          </span>
        )}
        <div className="flex-1" />
        {result && !result.binary && !result.truncated && (
          <>
            <span className="tabular-nums text-base-500">
              {formatSize(result.size)} · {lineCount} linhas · {formatTokens(tokenCount)}
            </span>
            <button
              className="flex items-center gap-1 rounded px-2 py-1 text-base-400 hover:bg-base-700/60 hover:text-base-200"
              onClick={copyContent}
              title="Copiar conteúdo"
            >
              <Copy size={12} />
              {copied ? 'copiado' : 'copiar'}
            </button>
          </>
        )}
        {canDiff && (
          <div className="flex overflow-hidden rounded border border-base-700/60">
            <button
              className={`flex items-center gap-1 px-2 py-1 ${mode === 'file' ? 'bg-accent-muted text-accent' : 'text-base-400 hover:bg-base-700/60'}`}
              onClick={() => setMode('file')}
            >
              <FileText size={12} />
              arquivo
            </button>
            <button
              className={`flex items-center gap-1 px-2 py-1 ${mode === 'diff' ? 'bg-accent-muted text-accent' : 'text-base-400 hover:bg-base-700/60'}`}
              onClick={() => setMode('diff')}
            >
              <GitCompare size={12} />
              diff
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-base-900">
        {!previewPath && (
          <div className="flex h-full items-center justify-center text-xs text-base-400">
            Clique em um arquivo no explorador para ver o conteúdo aqui — sem gastar tokens de IA.
          </div>
        )}
        {previewPath && loading && (
          <div className="flex h-full items-center justify-center text-xs text-base-400">Lendo arquivo…</div>
        )}
        {previewPath && !loading && result?.truncated && (
          <div className="flex h-full items-center justify-center text-xs text-base-400">
            Arquivo grande demais para pré-visualizar ({formatSize(result.size)}).
          </div>
        )}
        {previewPath && !loading && result?.binary && (
          <div className="flex h-full items-center justify-center text-xs text-base-400">
            Arquivo binário — sem pré-visualização.
          </div>
        )}
        {previewPath && !loading && result && !result.binary && !result.truncated && mode === 'file' && (
          <FileCodeView content={result.content} highlighted={highlighted} />
        )}
        {previewPath && mode === 'diff' && (
          <DiffCodeView loading={diffLoading} lines={diffLines} />
        )}
      </div>
    </div>
  )
}

function FileCodeView({ content, highlighted }: { content: string; highlighted: string }): JSX.Element {
  const lines = content.length ? content.split('\n') : []
  return (
    <div className="flex h-full overflow-auto">
      <div className="select-none whitespace-pre-wrap bg-base-850 px-3 py-2 text-right font-mono text-[12px] leading-[1.6] tabular-nums text-base-500">
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre className="min-w-0 flex-1 overflow-visible px-3 py-2 font-mono text-[12px] leading-[1.6]">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}

function diffLineClass(type: 'add' | 'remove' | 'hunk' | 'meta' | 'context'): string {
  switch (type) {
    case 'add':
      return 'bg-accent-muted text-accent-bright'
    case 'remove':
      return 'bg-danger/10 text-danger'
    case 'hunk':
      return 'text-base-400'
    case 'meta':
      return 'text-base-500'
    default:
      return 'text-base-300'
  }
}

function DiffCodeView({ loading, lines }: { loading: boolean; lines: ReturnType<typeof parseDiff> }): JSX.Element {
  if (loading) {
    return <div className="flex h-full items-center justify-center text-xs text-base-400">Lendo diff…</div>
  }
  if (lines.length === 0 || lines.every((l) => !l.text)) {
    return <div className="flex h-full items-center justify-center text-xs text-base-400">Sem diferenças em relação ao HEAD.</div>
  }
  return (
    <pre className="h-full overflow-auto px-3 py-2 font-mono text-[12px] leading-[1.6]">
      {lines.map((line, i) => (
        <div key={i} className={diffLineClass(line.type)}>
          {line.text || ' '}
        </div>
      ))}
    </pre>
  )
}
