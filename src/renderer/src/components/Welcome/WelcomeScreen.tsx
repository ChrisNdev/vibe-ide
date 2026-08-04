import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, Clock, Pin, X, Waypoints, RefreshCw, Sparkles } from 'lucide-react'
import type { RecentProject, PendingPatchNotes } from '@shared/types'
import PatchNotesModal from '@renderer/components/PatchNotes/PatchNotesModal'
import BackgroundLayer from '@renderer/components/Background/BackgroundLayer'
import { useBackgroundStore } from '@renderer/store/backgroundStore'

interface WelcomeScreenProps {
  onOpen: (path: string) => void
}

export default function WelcomeScreen({ onOpen }: WelcomeScreenProps): JSX.Element {
  const hasBackground = useBackgroundStore((s) => s.config.kind !== 'none')
  const [recents, setRecents] = useState<RecentProject[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [changelog, setChangelog] = useState<PendingPatchNotes | null>(null)
  const [loadingChangelog, setLoadingChangelog] = useState(false)

  const loadRecents = useCallback(async () => {
    const list = await window.api.recents.get()
    setRecents(list)
  }, [])

  useEffect(() => {
    void loadRecents().finally(() => setLoading(false))
    void window.api.app.getVersion().then(setVersion)
  }, [loadRecents])

  const handleRefresh = async (): Promise<void> => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await loadRecents()
    } finally {
      setRefreshing(false)
    }
  }

  const showChangelog = async (): Promise<void> => {
    if (loadingChangelog) return
    setLoadingChangelog(true)
    try {
      setChangelog(await window.api.app.getCurrentVersionNotes())
    } finally {
      setLoadingChangelog(false)
    }
  }

  const sorted = [...recents].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.lastOpened - a.lastOpened
  })

  const handleOpenFolder = async (): Promise<void> => {
    const picked = await window.api.dialog.openFolder()
    if (picked) onOpen(picked)
  }

  const togglePin = async (e: React.MouseEvent, path: string): Promise<void> => {
    e.stopPropagation()
    setRecents(await window.api.recents.togglePin(path))
  }

  const removeRecent = async (e: React.MouseEvent, path: string): Promise<void> => {
    e.stopPropagation()
    setRecents(await window.api.recents.remove(path))
  }

  return (
    <div className={`flex h-full w-full items-center justify-center ${hasBackground ? '' : 'bg-base-900'}`}>
      <BackgroundLayer />
      <div className="surface w-full max-w-md rounded-3xl border border-base-700/60 px-8 py-10 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted">
            <Waypoints size={26} className="text-accent" />
          </div>
          <h1 className="font-display text-xl font-black text-base-100">vibeIDE</h1>
          <p className="mt-1.5 text-[13px] text-base-400">Escolha uma pasta de projeto pra começar</p>
        </div>

        <button
          onClick={handleOpenFolder}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white shadow-lg shadow-accent/20 transition-all duration-150 ease-apple hover:bg-accent-bright active:scale-[0.98]"
        >
          <FolderOpen size={16} />
          Abrir pasta
        </button>

        {!loading && (
          <div className="mt-8">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-base-500">
              <Clock size={11} />
              Recentes
              <div className="flex-1" />
              <button
                onClick={handleRefresh}
                title="Atualizar lista"
                className="rounded-full p-1 text-base-400 transition-colors duration-150 hover:bg-base-700/60 hover:text-base-200"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            {sorted.length === 0 && <div className="px-2.5 py-2 text-[12px] text-base-500">Nenhum projeto recente</div>}
            <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {sorted.map((r) => (
                <div
                  key={r.path}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(r.path)}
                  className="group flex cursor-default items-center gap-2 rounded-xl px-2.5 py-2 transition-colors duration-150 hover:bg-base-800/70"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-base-100">{r.name}</div>
                    <div className="truncate text-[11px] text-base-500">{r.path}</div>
                  </div>
                  <button
                    onClick={(e) => togglePin(e, r.path)}
                    title={r.pinned ? 'Desafixar' : 'Fixar'}
                    className={`shrink-0 rounded-full p-1 hover:bg-base-700/60 ${
                      r.pinned ? 'text-accent opacity-100' : 'text-base-400 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Pin size={13} />
                  </button>
                  <button
                    onClick={(e) => removeRecent(e, r.path)}
                    title="Remover da lista"
                    className="shrink-0 rounded-full p-1 text-base-400 opacity-0 hover:bg-base-700/60 hover:text-danger group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {version && (
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-base-500">
            <span>vibeIDE v{version}</span>
            <span className="text-base-700">·</span>
            <button onClick={() => void showChangelog()} className="flex items-center gap-1 text-base-500 hover:text-accent" disabled={loadingChangelog}>
              <Sparkles size={11} />
              O que há de novo
            </button>
          </div>
        )}
      </div>
      {changelog && <PatchNotesModal patchNotes={changelog} onClose={() => setChangelog(null)} heading="notes" />}
    </div>
  )
}
