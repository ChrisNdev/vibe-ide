import { useState } from 'react'
import { GitCommitHorizontal, ArrowUp, ArrowDown, Loader2, Upload } from 'lucide-react'
import { useExplorerStore } from '@renderer/store/explorerStore'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export default function CommitBar(): JSX.Element | null {
  const rootPath = useExplorerStore((s) => s.rootPath)
  const isGitRepo = useExplorerStore((s) => s.isGitRepo)
  const gitBranch = useExplorerStore((s) => s.gitBranch)
  const gitAhead = useExplorerStore((s) => s.gitAhead)
  const gitBehind = useExplorerStore((s) => s.gitBehind)
  const gitStatus = useExplorerStore((s) => s.gitStatus)
  const refreshGitStatus = useExplorerStore((s) => s.refreshGitStatus)

  const [message, setMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!rootPath || !isGitRepo) return null

  const changedCount = Object.keys(gitStatus).length

  const handleCommit = async (): Promise<void> => {
    if (!message.trim() || committing) return
    setCommitting(true)
    setError(null)
    try {
      await window.api.git.commit(rootPath, message.trim())
      setMessage('')
      await refreshGitStatus()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCommitting(false)
    }
  }

  const handlePush = async (): Promise<void> => {
    if (pushing) return
    setPushing(true)
    setError(null)
    try {
      await window.api.git.push(rootPath)
      await refreshGitStatus()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="shrink-0 border-t border-base-700/60 bg-base-850 p-2">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] text-base-400">
        <span className="truncate font-medium text-base-300">{gitBranch ?? '—'}</span>
        {gitAhead > 0 && (
          <span className="flex items-center gap-0.5 tabular-nums text-accent">
            <ArrowUp size={11} />
            {gitAhead}
          </span>
        )}
        {gitBehind > 0 && (
          <span className="flex items-center gap-0.5 tabular-nums text-warn">
            <ArrowDown size={11} />
            {gitBehind}
          </span>
        )}
        <div className="flex-1" />
        {gitAhead > 0 && (
          <button
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-base-400 hover:bg-base-700/60 hover:text-base-200 disabled:opacity-40"
            onClick={handlePush}
            disabled={pushing}
            title="Enviar (push) para o remoto"
          >
            {pushing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            push
          </button>
        )}
      </div>

      {changedCount > 0 ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                void handleCommit()
              }
            }}
            placeholder={`Mensagem do commit (Ctrl+Enter) — inclui as ${changedCount} alterações`}
            rows={2}
            className="w-full resize-none rounded border border-base-700/60 bg-base-900 px-2 py-1 text-[12px] text-base-100 outline-none focus:border-ink-yellow"
          />
          <button
            className="flex items-center justify-center gap-1.5 rounded bg-accent px-2 py-1 text-[12px] font-medium text-base-950 hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
            onClick={handleCommit}
            disabled={committing || !message.trim()}
            title="Adiciona todas as alterações e commita"
          >
            {committing ? <Loader2 size={13} className="animate-spin" /> : <GitCommitHorizontal size={13} />}
            Commit ({changedCount})
          </button>
        </div>
      ) : (
        <div className="text-[11px] text-base-500">Nada para commitar</div>
      )}

      {error && <div className="mt-1.5 whitespace-pre-wrap text-[11px] text-danger">{error}</div>}
    </div>
  )
}
