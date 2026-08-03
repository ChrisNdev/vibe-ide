import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, TerminalSquare, Waypoints, Eye, Palette, Search, Bell, Activity, Camera, Plug } from 'lucide-react'
import TerminalPane from './components/Terminal/Terminal'
import FileExplorer from './components/Explorer/FileExplorer'
import MindMap from './components/MindMap/MindMap'
import PreviewPane from './components/Preview/PreviewPane'
import WelcomeScreen from './components/Welcome/WelcomeScreen'
import UpdateChecker from './components/UpdateChecker/UpdateChecker'
import BackgroundLayer from './components/Background/BackgroundLayer'
import BackgroundSettings from './components/Background/BackgroundSettings'
import SearchPanel from './components/Search/SearchPanel'
import QuickOpen from './components/Search/QuickOpen'
import HooksSettings from './components/Hooks/HooksSettings'
import ControlStrip from './components/Hooks/ControlStrip'
import ActivityPanel from './components/Activity/ActivityPanel'
import CheckpointsPanel from './components/Checkpoints/CheckpointsPanel'
import McpSettings from './components/Mcp/McpSettings'
import { useTerminalStore, nextTerminalId } from './store/terminalStore'
import { useExplorerStore } from './store/explorerStore'
import { useBackgroundStore } from './store/backgroundStore'
import { useActivityStore, ensureTranscriptSubscription } from './store/activityStore'

type MainView = 'terminal' | 'mindmap' | 'preview' | 'activity'

const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 560

export default function App(): JSX.Element {
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const addTab = useTerminalStore((s) => s.addTab)
  const rootPath = useExplorerStore((s) => s.rootPath)
  const setRoot = useExplorerStore((s) => s.setRoot)
  const setPreview = useExplorerStore((s) => s.setPreview)
  const [ready, setReady] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<MainView>('terminal')
  const [bgSettingsOpen, setBgSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const [hooksSettingsOpen, setHooksSettingsOpen] = useState(false)
  const [checkpointsOpen, setCheckpointsOpen] = useState(false)
  const [mcpOpen, setMcpOpen] = useState(false)
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
    ensureTranscriptSubscription()
    return () => {
      cancelled = true
    }
  }, [loadBackground])

  useEffect(() => {
    if (!rootPath) return
    void useActivityStore.getState().start(rootPath)
  }, [rootPath])

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

  useEffect(() => {
    if (!rootPath) return
    const handleKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setQuickOpenOpen(false)
        setSearchOpen((v) => !v)
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setSearchOpen(false)
        setQuickOpenOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [rootPath])

  const openSearchResult = useCallback(
    (file: string, line: number) => {
      setPreview(file, line)
      setView('preview')
      setSearchOpen(false)
    },
    [setPreview]
  )

  const openQuickOpenResult = useCallback(
    (file: string) => {
      setPreview(file)
      setView('preview')
      setQuickOpenOpen(false)
    },
    [setPreview]
  )

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
          <button
            title="Atividade — o que o agente está fazendo, tokens e custo"
            className={`rounded p-1 hover:bg-base-700/60 ${view === 'activity' ? 'text-accent' : 'text-base-400 hover:text-base-200'}`}
            onClick={() => setView('activity')}
          >
            <Activity size={14} />
          </button>
          <div className="flex-1" />
          <ControlStrip />
          <button
            title="Buscar no projeto (Ctrl+Shift+F)"
            className={`rounded p-1 hover:bg-base-700/60 ${searchOpen ? 'text-accent' : 'text-base-400 hover:text-base-200'}`}
            onClick={() => {
              setQuickOpenOpen(false)
              setSearchOpen((v) => !v)
            }}
          >
            <Search size={14} />
          </button>
          <button
            title="Aparência — fundo personalizável"
            className={`rounded p-1 hover:bg-base-700/60 ${bgSettingsOpen ? 'text-accent' : 'text-base-400 hover:text-base-200'}`}
            onClick={() => setBgSettingsOpen((v) => !v)}
          >
            <Palette size={14} />
          </button>
          <button
            title="Hooks e notificações"
            className={`rounded p-1 hover:bg-base-700/60 ${hooksSettingsOpen ? 'text-accent' : 'text-base-400 hover:text-base-200'}`}
            onClick={() => setHooksSettingsOpen((v) => !v)}
          >
            <Bell size={14} />
          </button>
          <button
            title="Checkpoints"
            className={`rounded p-1 hover:bg-base-700/60 ${checkpointsOpen ? 'text-accent' : 'text-base-400 hover:text-base-200'}`}
            onClick={() => setCheckpointsOpen((v) => !v)}
          >
            <Camera size={14} />
          </button>
          <button
            title="Servidor MCP"
            className={`rounded p-1 hover:bg-base-700/60 ${mcpOpen ? 'text-accent' : 'text-base-400 hover:text-base-200'}`}
            onClick={() => setMcpOpen((v) => !v)}
          >
            <Plug size={14} />
          </button>
          <UpdateChecker />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {tabs.map((tab) => (
            <TerminalPane
              key={tab.id}
              id={tab.id}
              cwd={tab.cwd}
              autoRun={tab.autoRunCommand ?? (tab.kind === 'claude' ? 'claude' : undefined)}
              fontSize={14}
              active={view === 'terminal' && tab.id === activeTabId}
            />
          ))}
          <MindMap rootPath={rootPath} active={view === 'mindmap'} />
          <PreviewPane active={view === 'preview'} />
          <ActivityPanel active={view === 'activity'} onResumed={() => setView('terminal')} />
        </div>
      </div>
      {bgSettingsOpen && <BackgroundSettings onClose={() => setBgSettingsOpen(false)} />}
      {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} onOpenResult={openSearchResult} />}
      {quickOpenOpen && <QuickOpen onClose={() => setQuickOpenOpen(false)} onOpenResult={openQuickOpenResult} />}
      {hooksSettingsOpen && <HooksSettings onClose={() => setHooksSettingsOpen(false)} />}
      {checkpointsOpen && <CheckpointsPanel onClose={() => setCheckpointsOpen(false)} />}
      {mcpOpen && <McpSettings onClose={() => setMcpOpen(false)} />}
    </div>
  )
}
