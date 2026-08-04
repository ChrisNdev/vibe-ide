import { useEffect, useState } from 'react'
import { RotateCcw, AlertTriangle, Camera } from 'lucide-react'
import { useExplorerStore } from '@renderer/store/explorerStore'
import { parseDiff } from '@renderer/components/Preview/diff'
import SidePanel from '@renderer/components/ui/SidePanel'
import type { CheckpointMeta, GitRepoCheckResult } from '@shared/types'

interface CheckpointsPanelProps {
  onClose: () => void
}

function diffLineClass(type: ReturnType<typeof parseDiff>[number]['type']): string {
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

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  return `${Math.round(hours / 24)}d atrás`
}

export default function CheckpointsPanel({ onClose }: CheckpointsPanelProps): JSX.Element {
  const rootPath = useExplorerStore((s) => s.rootPath)
  const [repoCheck, setRepoCheck] = useState<GitRepoCheckResult | null>(null)
  const [checkpoints, setCheckpoints] = useState<CheckpointMeta[]>([])
  const [selected, setSelected] = useState<CheckpointMeta | null>(null)
  const [diffText, setDiffText] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    if (!rootPath) return
    setCheckpoints(await window.api.checkpoints.list(rootPath))
  }

  useEffect(() => {
    if (!rootPath) return
    void window.api.checkpoints.checkRepo(rootPath).then(setRepoCheck)
    void refresh()
    const off = window.api.checkpoints.onEvent(() => void refresh())
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath])

  const openDiff = async (cp: CheckpointMeta): Promise<void> => {
    if (!rootPath) return
    setSelected(cp)
    setConfirming(false)
    setDiffText(null)
    setDiffText(await window.api.checkpoints.diff(rootPath, cp.commit))
  }

  const doRestore = async (): Promise<void> => {
    if (!rootPath || !selected) return
    setRestoring(true)
    const result = await window.api.checkpoints.restore(rootPath, selected.commit)
    setRestoring(false)
    setConfirming(false)
    setStatus(result.ok ? `Restaurado — ${result.filesChanged.length} arquivo(s) alterado(s)` : result.error ?? 'Falha ao restaurar')
    await refresh()
  }

  const diffLines = diffText ? parseDiff(diffText) : []
  const changedFiles = [...new Set(diffLines.filter((l) => l.type === 'meta' && l.text.startsWith('+++ b/')).map((l) => l.text.slice(6)))]

  return (
    <SidePanel title="Checkpoints" icon={Camera} onClose={onClose} width={460}>
      {!rootPath && <div className="p-3 text-[12px] text-base-500">Abra uma pasta primeiro.</div>}

      {rootPath && repoCheck && !repoCheck.isGitRepo && (
        <div className="p-3 text-[12px] text-base-500">
          Checkpoints desabilitados — esta pasta não é um repositório git. O vibeIDE não inicializa um repositório por conta própria.
        </div>
      )}

      {rootPath && repoCheck?.isGitRepo && (
        <div className="flex min-h-0 flex-1">
          <div className="flex w-[180px] shrink-0 flex-col overflow-y-auto border-r border-base-800">
            {repoCheck.hasSubmodules && (
              <div className="m-1.5 flex items-start gap-1.5 rounded border border-ink-yellow/50 bg-ink-yellow/10 p-1.5 text-[10px] text-ink-yellow">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                Submódulos não são versionados nos checkpoints.
              </div>
            )}
            {checkpoints.length === 0 && <div className="p-2 text-[11px] text-base-500">Nenhum checkpoint ainda — criado antes de cada edição.</div>}
            {checkpoints.map((cp) => (
              <button
                key={cp.ref}
                onClick={() => void openDiff(cp)}
                className={`flex flex-col gap-0.5 border-b border-base-800 px-2 py-1.5 text-left ${
                  selected?.ref === cp.ref ? 'bg-accent-muted' : 'hover:bg-base-800/70'
                }`}
              >
                <span className="truncate text-[11px] text-base-200">{cp.label}</span>
                <span className="tabular-nums text-[10px] text-base-500">{relativeTime(cp.timestamp)}</span>
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {!selected && <div className="p-3 text-[12px] text-base-500">Selecione um checkpoint pra ver o diff.</div>}
            {selected && (
              <>
                <div className="flex items-center gap-2 border-b border-base-800 px-2 py-1.5">
                  <span className="truncate text-[11px] text-base-400">{selected.label}</span>
                  <div className="flex-1" />
                  {!confirming ? (
                    <button
                      onClick={() => setConfirming(true)}
                      className="flex items-center gap-1 rounded bg-base-800 px-2 py-1 text-[10px] text-base-300 hover:bg-base-700/60"
                    >
                      <RotateCcw size={11} />
                      Restaurar
                    </button>
                  ) : (
                    <span className="text-[10px] text-ink-yellow">confirmar abaixo ↓</span>
                  )}
                </div>

                {confirming && (
                  <div className="border-b border-ink-yellow/40 bg-ink-yellow/10 p-2 text-[11px] text-ink-yellow">
                    <div className="mb-1 font-medium">
                      Isso sobrescreve {changedFiles.length} arquivo(s) com o estado deste checkpoint. Um checkpoint do estado atual é
                      criado antes, então dá pra voltar.
                    </div>
                    <ul className="mb-2 max-h-24 overflow-y-auto font-mono text-[10px]">
                      {changedFiles.map((f) => (
                        <li key={f} className="truncate">
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-1.5">
                      <button
                        disabled={restoring}
                        onClick={() => void doRestore()}
                        className="rounded bg-danger px-2 py-1 text-[10px] font-medium text-base-950 hover:bg-danger/80 disabled:opacity-40"
                      >
                        {restoring ? 'Restaurando…' : 'Confirmar restauração'}
                      </button>
                      <button onClick={() => setConfirming(false)} className="rounded bg-base-800 px-2 py-1 text-[10px] text-base-300 hover:bg-base-700/60">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <pre className="min-h-0 flex-1 overflow-auto px-2 py-1.5 font-mono text-[11px] leading-[1.5]">
                  {diffLines.length === 0 && <span className="text-base-500">Sem diferenças em relação ao estado atual.</span>}
                  {diffLines.map((line, i) => (
                    <div key={i} className={diffLineClass(line.type)}>
                      {line.text || ' '}
                    </div>
                  ))}
                </pre>
              </>
            )}
          </div>
        </div>
      )}

      {status && (
        <div className="border-t border-rule px-3 py-1.5 text-[11px] text-base-400">{status}</div>
      )}
    </SidePanel>
  )
}
