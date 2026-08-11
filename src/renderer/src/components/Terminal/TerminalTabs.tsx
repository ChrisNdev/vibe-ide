import { X, Plus } from 'lucide-react'
import { useTerminalStore, nextTerminalId } from '@renderer/store/terminalStore'
import { useExplorerStore } from '@renderer/store/explorerStore'

export default function TerminalTabs(): JSX.Element | null {
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const setActive = useTerminalStore((s) => s.setActive)
  const removeTab = useTerminalStore((s) => s.removeTab)
  const addTab = useTerminalStore((s) => s.addTab)
  const rootPath = useExplorerStore((s) => s.rootPath)

  // Hidden only with zero tabs. Hiding it at 1 tab also hid the "+" button, and "+" is the only
  // way to reach a second tab — so a second terminal could never be opened at all.
  if (tabs.length === 0) return null

  const closeTab = async (id: string): Promise<void> => {
    await window.api.pty.kill(id)
    removeTab(id)
  }

  const newShellTab = (): void => {
    if (!rootPath) return
    addTab({ id: nextTerminalId(), cwd: rootPath, title: 'shell', kind: 'shell', shellId: null, isRunning: true, exitCode: null })
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-base-800 px-1">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActive(tab.id)}
          className={`group flex cursor-default items-center gap-1.5 rounded-t px-2 py-1 text-[11px] ${
            tab.id === activeTabId ? 'bg-base-800 text-base-100' : 'text-base-500 hover:bg-base-800/50'
          }`}
        >
          <span className="truncate">{tab.title}</span>
          {!tab.isRunning && <span className="tabular-nums text-danger">({tab.exitCode})</span>}
          <button
            onClick={(e) => {
              e.stopPropagation()
              void closeTab(tab.id)
            }}
            className="rounded p-0.5 opacity-0 hover:bg-base-700 group-hover:opacity-100"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      <button onClick={newShellTab} title="Novo terminal" className="rounded p-1 text-base-500 hover:bg-base-700/60 hover:text-base-200">
        <Plus size={12} />
      </button>
    </div>
  )
}
