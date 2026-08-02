import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, Clock, Pin, X, Waypoints, RefreshCw } from 'lucide-react'
import type { RecentProject } from '@shared/types'

interface WelcomeScreenProps {
  onOpen: (path: string) => void
}

export default function WelcomeScreen({ onOpen }: WelcomeScreenProps): JSX.Element {
  const [recents, setRecents] = useState<RecentProject[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadRecents = useCallback(async () => {
    const list = await window.api.recents.get()
    setRecents(list)
  }, [])

  useEffect(() => {
    void loadRecents().finally(() => setLoading(false))
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
    <div className="flex h-full w-full items-center justify-center bg-base-900">
      <div className="w-full max-w-md px-6">
        <div className="mb-8 flex flex-col items-center text-center">
          <Waypoints size={28} className="mb-3 text-accent" />
          <h1 className="text-lg font-semibold text-base-100">Claude IDE</h1>
          <p className="mt-1 text-xs text-base-400">Escolha uma pasta de projeto pra começar</p>
        </div>

        <button
          onClick={handleOpenFolder}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-base-950 hover:bg-accent-bright"
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
                className="rounded p-1 text-base-400 hover:bg-base-700/60 hover:text-base-200"
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
                  className="group flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 hover:bg-base-800/70"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-base-100">{r.name}</div>
                    <div className="truncate text-[11px] text-base-500">{r.path}</div>
                  </div>
                  <button
                    onClick={(e) => togglePin(e, r.path)}
                    title={r.pinned ? 'Desafixar' : 'Fixar'}
                    className={`shrink-0 rounded p-1 hover:bg-base-700/60 ${
                      r.pinned ? 'text-accent opacity-100' : 'text-base-400 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Pin size={13} />
                  </button>
                  <button
                    onClick={(e) => removeRecent(e, r.path)}
                    title="Remover da lista"
                    className="shrink-0 rounded p-1 text-base-400 opacity-0 hover:bg-base-700/60 hover:text-danger group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
