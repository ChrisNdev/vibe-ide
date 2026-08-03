import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, TerminalSquare, Waypoints, Eye, Palette } from 'lucide-react'
import TerminalPane from './components/Terminal/Terminal'
import FileExplorer from './components/Explorer/FileExplorer'
import MindMap from './components/MindMap/MindMap'
import PreviewPane from './components/Preview/PreviewPane'
import WelcomeScreen from './components/Welcome/WelcomeScreen'
import UpdateChecker from './components/UpdateChecker/UpdateChecker'
import BackgroundLayer from './components/Background/BackgroundLayer'
import BackgroundSettings from './components/Background/BackgroundSettings'
import { useTerminalStore, nextTerminalId } from './store/terminalStore'
import { useExplorerStore } from './store/explorerStore'
import { useBackgroundStore } from './store/backgroundStore'

type MainView = 'terminal' | 'mindmap' | 'preview'

const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 560

export default function App(): JSX.Element {
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const addTab = useTerminalStore((s) => s.addTab)
  const rootPath = useExplorerStore((s) => s.rootPath)
  const setRoot = useExplorerStore((s) => s.setRoot)
  const [ready, setReady] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<MainView>('terminal')
  const [bgSettingsOpen, setBgSettingsOpen] = useState(false)
  const resizing = useRef(false)
  const hasBackground = useBackgroundStore((s) => s.config.kind !== 'none')
  const loadBackground = useBackgroundStore((s) => s.load)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const settings = await window.api.settings.get()
      if (cancelled) return
      setSidebarWidth(settings.sidebarWidth)
      setSidebarCollapsed(settings.sidebarCollapsed)
      setReady(true)
    })()
    void loadBackground()
    return () => {
      cancelled = true
    }
  }, [loadBackground])

  const openProject = useCallback(
    async (path: string): Promise<void> => {
      await setRoot(path)
      void window.api.recents.add(path)
      addTab({
        id: nextTerminalId(),
        cwd: path,
        title: 'claude',
        kind: 'claude',
        shellId: null,
        isRunning: true,
        exitCode: null
      })
    },
    [setRoot, addTab]
  )

  const toggleSidebar = (): void => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    void window.api.settings.set({ sidebarCollapsed: next })
  }

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = true

    const handleMove = (moveEvent: MouseEvent): void => {
      if (!resizing.current) return
      const next = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, moveEvent.clientX))
      setSidebarWidth(next)
    }
    const handleUp = (upEvent: MouseEvent): void => {
      resizing.current = false
      const next = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, upEvent.clientX))
      void window.api.settings.set({ sidebarWidth: next })
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [])

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-base-900">
        <span className="font-mono text-xs text-base-400">iniciando…</span>
      </div>
    )
  }

  if (!rootPath) {
    return <WelcomeScreen onOpen={openProject} />
  }

  return (
    <div className={`flex h-full w-full ${hasBackground ? 'has-background' : 'bg-base-900'}`}>
      <BackgroundLayer />
      {!sidebarCollapsed && (
        <>
          <div style={{ width: sidebarWidth }} className="surface flex h-full shrink-0 flex-col">
            <FileExplorer />
          </div>
          <div
            className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-accent/30"
            onMouseDown={startResize}
          />
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1 px-2 py-1.5">
          <button
            title={sidebarCollapsed ? 'Mostrar explorador' : 'Ocultar explorador'}
            className="rounded p-1 text-base-400 hover:bg-base-700/60 hover:text-base-200"
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
          <div className="mx-1 h-4 w-px bg-base-700/60" />
          <button
            title="Terminal"
            className={`rounded p-1 hover:bg-base-700/60 ${view === 'terminal' ? 'text-accent' : 'text-base-400 hover:text-base-200'}`}
            onClick={() => setView('terminal')}
          >
            <TerminalSquare size={14} />
          </button>
          <button
            title="Mapa mental do projeto"
            className={`rounded p-1 hover:bg-base-700/60 ${view === 'mindmap' ? 'text-accent' : 'text-base-400 hover:text-base-200'}`}
            onClick={() => setView('mindmap')}
          >
            <Waypoints size={14} />
          </button>
          <button
            title="Visualizador de arquivo (local, sem gastar tokens de IA)"
            className={`rounded p-1 hover:bg-base-700/60 ${view === 'preview' ? 'text-accent' : 'text-base-400 hover:text-base-200'}`}
            onClick={() => setView('preview')}
          >
            <Eye size={14} />
          </button>
          <div className="flex-1" />
          <button
            title="Aparência — fundo personalizável"
            className={`rounded p-1 hover:bg-base-700/60 ${bgSettingsOpen ? 'text-accent' : 'text-base-400 hover:text-base-200'}`}
            onClick={() => setBgSettingsOpen((v) => !v)}
          >
            <Palette size={14} />
          </button>
          <UpdateChecker />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {tabs.map((tab) => (
            <TerminalPane
              key={tab.id}
              id={tab.id}
              cwd={tab.cwd}
              autoRun="claude"
              fontSize={14}
              active={view === 'terminal' && tab.id === activeTabId}
            />
          ))}
          <MindMap rootPath={rootPath} active={view === 'mindmap'} />
          <PreviewPane active={view === 'preview'} />
        </div>
      </div>
      {bgSettingsOpen && <BackgroundSettings onClose={() => setBgSettingsOpen(false)} />}
    </div>
  )
}
