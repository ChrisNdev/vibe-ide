import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, TerminalSquare, Waypoints, Eye, Palette, Search, Bell, Activity, Camera, Plug, FlaskConical, GitBranch, MoreHorizontal } from 'lucide-react'
import MoreMenu from './components/ui/MoreMenu'
import OnboardingModal from './components/Onboarding/OnboardingModal'
import TitleBar from './components/TitleBar/TitleBar'
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
import VerificationPanel from './components/Verification/VerificationPanel'
import TerminalTabs from './components/Terminal/TerminalTabs'
import WorktreePanel from './components/Worktree/WorktreePanel'
import PatchNotesModal from './components/PatchNotes/PatchNotesModal'
import { useTerminalStore, nextTerminalId } from './store/terminalStore'
import { useExplorerStore } from './store/explorerStore'
import { useBackgroundStore } from './store/backgroundStore'
import { useActivityStore, ensureTranscriptSubscription } from './store/activityStore'
import type { PendingPatchNotes } from '@shared/types'

type MainView = 'terminal' | 'mindmap' | 'preview' | 'activity' | 'verification'
type OverlayKind = 'background' | 'search' | 'quickOpen' | 'hooks' | 'checkpoints' | 'mcp' | 'worktree' | null

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
  // One slot for every right-side panel/overlay instead of 7 independent booleans — the previous
  // shape let them stack invisibly on top of each other (same position, same z-index, decided by
  // DOM order rather than click order), so opening a second one while another was open silently
  // did nothing visible. A single active slot makes that impossible by construction.
  const [activeOverlay, setActiveOverlay] = useState<OverlayKind>(null)
  const [patchNotes, setPatchNotes] = useState<PendingPatchNotes | null>(null)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
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
    void window.api.app.getPendingPatchNotes().then((pending) => {
      if (!cancelled && pending) setPatchNotes(pending)
    })
    return () => {
      cancelled = true
    }
  }, [loadBackground])

  useEffect(() => {
    if (!rootPath) return
    void useActivityStore.getState().start(rootPath)
  }, [rootPath])

  useEffect(() => {
    if (!rootPath) return
    if (localStorage.getItem('vibeide.onboardingSeen')) return
    setShowOnboarding(true)
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

  const iconBtnClass = (active: boolean): string =>
    `rounded-lg p-1.5 transition-colors duration-150 ease-apple ${
      active ? 'bg-accent-muted text-accent' : 'text-base-400 hover:bg-base-700/60 hover:text-base-200'
    }`

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

  const toggleOverlay = useCallback((kind: OverlayKind) => {
    setActiveOverlay((cur) => (cur === kind ? null : kind))
  }, [])

  useEffect(() => {
    if (!rootPath) return
    const handleKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleOverlay('search')
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        toggleOverlay('quickOpen')
      } else if (e.key === 'Escape') {
        setActiveOverlay(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [rootPath, toggleOverlay])

  const openSearchResult = useCallback(
    (file: string, line: number) => {
      setPreview(file, line)
      setView('preview')
      setActiveOverlay(null)
    },
    [setPreview]
  )

  const openQuickOpenResult = useCallback(
    (file: string) => {
      setPreview(file)
      setView('preview')
      setActiveOverlay(null)
    },
    [setPreview]
  )

  if (!ready) {
    return (
      <div className="flex h-full w-full flex-col">
        <TitleBar />
        <div className="flex flex-1 items-center justify-center bg-base-900">
          <span className="font-mono text-xs text-base-400">iniciando…</span>
        </div>
      </div>
    )
  }

  // Rendered unconditionally below (not per-branch) so a pending patch-notes prompt shows up
  // whether or not a project is already open — it used to be nested only inside the "project
  // open" branch, so it silently never appeared for anyone who updated and hadn't reopened a
  // project yet.
  const patchNotesModal = patchNotes && <PatchNotesModal patchNotes={patchNotes} onClose={() => setPatchNotes(null)} />

  if (!rootPath) {
    return (
      <div className="flex h-full w-full flex-col">
        <TitleBar />
        <div className="min-h-0 flex-1">
          <WelcomeScreen onOpen={openProject} />
        </div>
        {patchNotesModal}
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      <TitleBar />
      <div className={`flex min-h-0 flex-1 ${hasBackground ? 'has-background' : 'bg-base-900'}`}>
      <BackgroundLayer />
      {!sidebarCollapsed && (
        <>
          <div style={{ width: sidebarWidth }} className="surface-tint flex h-full shrink-0 flex-col border-r border-base-700/60">
            <FileExplorer />
          </div>
          <div
            className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-accent/30"
            onMouseDown={startResize}
          />
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="surface-tint flex items-center gap-0.5 border-b border-base-700/60 px-2 py-2">
          <button
            title={sidebarCollapsed ? 'Mostrar explorador' : 'Ocultar explorador'}
            className={iconBtnClass(false)}
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
          <div className="mx-1.5 h-4 w-px bg-base-700/60" />
          <button title="Terminal" className={iconBtnClass(view === 'terminal')} onClick={() => setView('terminal')}>
            <TerminalSquare size={14} />
          </button>
          <button title="Mapa mental do projeto" className={iconBtnClass(view === 'mindmap')} onClick={() => setView('mindmap')}>
            <Waypoints size={14} />
          </button>
          <button
            title="Visualizador de arquivo (local, sem gastar tokens de IA)"
            className={iconBtnClass(view === 'preview')}
            onClick={() => setView('preview')}
          >
            <Eye size={14} />
          </button>
          <button
            title="Atividade — o que o agente está fazendo, tokens e custo"
            className={iconBtnClass(view === 'activity')}
            onClick={() => setView('activity')}
          >
            <Activity size={14} />
          </button>
          <button
            title="Verificação — rodar scripts, ver o preview, diagnósticos"
            className={iconBtnClass(view === 'verification')}
            onClick={() => setView('verification')}
          >
            <FlaskConical size={14} />
          </button>
          <div className="flex-1" />
          <ControlStrip />
          <button title="Buscar no projeto (Ctrl+Shift+F)" className={iconBtnClass(activeOverlay === 'search')} onClick={() => toggleOverlay('search')}>
            <Search size={14} />
          </button>
          <button
            ref={moreButtonRef}
            title="Mais opções"
            className={iconBtnClass(moreMenuOpen || ['background', 'hooks', 'checkpoints', 'mcp', 'worktree'].includes(activeOverlay ?? ''))}
            onClick={() => setMoreMenuOpen((v) => !v)}
          >
            <MoreHorizontal size={14} />
          </button>
          <UpdateChecker />
        </div>
        {view === 'terminal' && <TerminalTabs />}
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
          <VerificationPanel active={view === 'verification'} />
        </div>
      </div>
      {activeOverlay === 'background' && <BackgroundSettings onClose={() => setActiveOverlay(null)} />}
      {activeOverlay === 'search' && <SearchPanel onClose={() => setActiveOverlay(null)} onOpenResult={openSearchResult} />}
      {activeOverlay === 'quickOpen' && <QuickOpen onClose={() => setActiveOverlay(null)} onOpenResult={openQuickOpenResult} />}
      {activeOverlay === 'hooks' && <HooksSettings onClose={() => setActiveOverlay(null)} />}
      {activeOverlay === 'checkpoints' && <CheckpointsPanel onClose={() => setActiveOverlay(null)} />}
      {activeOverlay === 'mcp' && <McpSettings onClose={() => setActiveOverlay(null)} />}
      {activeOverlay === 'worktree' && (
        <WorktreePanel
          onClose={() => setActiveOverlay(null)}
          onOpenTerminal={() => {
            setView('terminal')
            setActiveOverlay(null)
          }}
        />
      )}
      {moreMenuOpen && (
        <MoreMenu
          anchorRef={moreButtonRef}
          onClose={() => setMoreMenuOpen(false)}
          items={[
            {
              label: 'Aparência',
              description: 'Muda a imagem ou cor de fundo do app',
              icon: Palette,
              active: activeOverlay === 'background',
              onSelect: () => toggleOverlay('background')
            },
            {
              label: 'Notificações',
              description: 'Avisa no computador quando o Claude termina ou precisa de você',
              icon: Bell,
              active: activeOverlay === 'hooks',
              onSelect: () => toggleOverlay('hooks')
            },
            {
              label: 'Pontos de restauração',
              description: 'Guarda um retrato dos arquivos antes de cada mudança, pra poder voltar atrás',
              icon: Camera,
              active: activeOverlay === 'checkpoints',
              onSelect: () => toggleOverlay('checkpoints')
            },
            {
              label: 'Ferramentas extras pro Claude',
              description: 'Deixa o Claude enxergar o projeto sem precisar procurar arquivo por arquivo',
              icon: Plug,
              active: activeOverlay === 'mcp',
              onSelect: () => toggleOverlay('mcp')
            },
            {
              label: 'Tarefas em paralelo',
              description: 'Roda mais de um Claude ao mesmo tempo, cada um numa cópia separada do projeto',
              icon: GitBranch,
              active: activeOverlay === 'worktree',
              onSelect: () => toggleOverlay('worktree')
            }
          ]}
        />
      )}
      {showOnboarding && (
        <OnboardingModal
          onClose={() => {
            localStorage.setItem('vibeide.onboardingSeen', '1')
            setShowOnboarding(false)
          }}
        />
      )}
      {patchNotesModal}
      </div>
    </div>
  )
}
