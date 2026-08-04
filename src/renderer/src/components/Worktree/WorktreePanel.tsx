import { useEffect, useState } from 'react'
import { GitBranch, GitMerge, Trash2, Plus } from 'lucide-react'
import { useExplorerStore } from '@renderer/store/explorerStore'
import { useTerminalStore, nextTerminalId } from '@renderer/store/terminalStore'
import { parseDiff } from '@renderer/components/Preview/diff'
import SidePanel from '@renderer/components/ui/SidePanel'
import type { WorktreeInfo, AgentStatus } from '@shared/types'

interface WorktreePanelProps {
  onClose: () => void
  onOpenTerminal: () => void
}

const STATUS_LABEL: Record<AgentStatus, string> = { running: 'rodando', waiting: 'aguardando entrada', idle: 'concluído' }
const STATUS_CLASS: Record<AgentStatus, string> = { running: 'text-ink-cyan', waiting: 'text-ink-yellow', idle: 'text-muted' }

export default function WorktreePanel({ onClose, onOpenTerminal }: WorktreePanelProps): JSX.Element {
  const rootPath = useExplorerStore((s) => s.rootPath)
  const addTab = useTerminalStore((s) => s.addTab)
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([])
  const [taskName, setTaskName] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [selected, setSelected] = useState<WorktreeInfo | null>(null)
  const [diffText, setDiffText] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    if (!rootPath) return
    setWorktrees(await window.api.worktree.list(rootPath))
  }

  useEffect(() => {
    void refresh()
    const off = window.api.worktree.onStatusEvent((evt) => {
      setWorktrees((prev) => prev.map((w) => (w.path === evt.path ? { ...w, status: evt.status } : w)))
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath])

  const createTask = async (): Promise<void> => {
    if (!rootPath || !taskName.trim()) return
    setBusy(true)
    const result = await window.api.worktree.create(rootPath, taskName.trim())
    setBusy(false)
    if (!result.ok || !result.path) {
      setStatus(result.error ?? 'Falha ao criar worktree')
      return
    }
    setTaskName('')
    await refresh()
    addTab({
      id: nextTerminalId(),
      cwd: result.path,
      title: taskName.trim().slice(0, 20),
      kind: 'claude',
      shellId: null,
      isRunning: true,
      exitCode: null,
      autoRunCommand: 'claude'
    })
    onOpenTerminal()
  }

  const openDiff = async (w: WorktreeInfo): Promise<void> => {
    if (!rootPath) return
    setSelected(w)
    setDiffText(null)
    setDiffText(await window.api.worktree.diff(rootPath, w.branch))
  }

  const merge = async (w: WorktreeInfo): Promise<void> => {
    if (!rootPath) return
    setBusy(true)
    const result = await window.api.worktree.merge(rootPath, w.branch)
    setBusy(false)
    setStatus(result.ok ? `${w.branch} mesclada` : result.error ?? 'Falha ao mesclar')
  }

  const remove = async (w: WorktreeInfo): Promise<void> => {
    if (!rootPath) return
    setBusy(true)
    const result = await window.api.worktree.remove(rootPath, w.path)
    setBusy(false)
    setConfirmRemove(null)
    if (result.ok) {
      if (selected?.path === w.path) setSelected(null)
      await refresh()
    } else {
      setStatus(result.error ?? 'Falha ao remover')
    }
  }

  const diffLines = diffText ? parseDiff(diffText) : []

  return (
    <SidePanel title="Tarefas paralelas" icon={GitBranch} onClose={onClose} width={480}>
      {!rootPath && <div className="p-3 text-[12px] text-base-500">Abra uma pasta primeiro.</div>}

      {rootPath && (
        <>
          <div className="flex gap-1.5 border-b border-base-800 p-2">
            <input
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void createTask()}
              placeholder="nome da tarefa"
              className="flex-1 rounded border border-base-700/60 bg-base-900 px-2 py-1 text-[12px] outline-none focus:border-ink-yellow"
            />
            <button
              disabled={busy || !taskName.trim()}
              onClick={() => void createTask()}
              className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-[11px] font-medium text-base-950 hover:bg-accent-bright disabled:opacity-40"
            >
              <Plus size={12} />
              nova tarefa
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="flex w-[200px] shrink-0 flex-col overflow-y-auto border-r border-base-800">
              {worktrees.length === 0 && <div className="p-2 text-[11px] text-base-500">Nenhuma tarefa paralela ainda.</div>}
              {worktrees.map((w) => (
                <div key={w.path} className={`flex flex-col gap-1 border-b border-base-800 p-2 ${selected?.path === w.path ? 'bg-base-800' : ''}`}>
                  <button onClick={() => void openDiff(w)} className="truncate text-left text-[11px] text-base-200 hover:text-accent">
                    {w.branch}
                  </button>
                  <span className={`text-[10px] ${STATUS_CLASS[w.status]}`}>{STATUS_LABEL[w.status]}</span>
                  <div className="flex gap-1">
                    <button onClick={() => void merge(w)} title="Mesclar na branch atual" className="rounded p-1 text-base-500 hover:bg-base-700/60 hover:text-accent">
                      <GitMerge size={11} />
                    </button>
                    <button onClick={() => setConfirmRemove(w.path)} title="Remover worktree" className="rounded p-1 text-base-500 hover:bg-base-700/60 hover:text-danger">
                      <Trash2 size={11} />
                    </button>
                  </div>
                  {confirmRemove === w.path && (
                    <div className="rounded border border-danger/40 bg-danger/10 p-1.5 text-[10px] text-danger">
                      Remove o worktree em disco (o branch fica). Confirma?
                      <div className="mt-1 flex gap-1">
                        <button onClick={() => void remove(w)} className="rounded bg-danger px-1.5 py-0.5 text-base-950">
                          remover
                        </button>
                        <button onClick={() => setConfirmRemove(null)} className="rounded bg-base-800 px-1.5 py-0.5 text-base-300">
                          cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <pre className="min-h-0 flex-1 overflow-auto px-2 py-1.5 font-mono text-[11px] leading-[1.5]">
              {!selected && <span className="text-base-500">Selecione uma tarefa pra ver o diff contra a branch atual.</span>}
              {selected &&
                diffLines.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.type === 'add'
                        ? 'bg-accent-muted text-accent-bright'
                        : line.type === 'remove'
                          ? 'bg-danger/10 text-danger'
                          : line.type === 'hunk'
                            ? 'text-base-400'
                            : line.type === 'meta'
                              ? 'text-base-500'
                              : 'text-base-300'
                    }
                  >
                    {line.text || ' '}
                  </div>
                ))}
            </pre>
          </div>
        </>
      )}
      {status && <div className="border-t border-rule px-3 py-1.5 text-[11px] text-base-400">{status}</div>}
    </SidePanel>
  )
}
