import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X, Waypoints } from 'lucide-react'

/**
 * The window is fully frameless (no titleBarOverlay — see src/main/index.ts) so this draws
 * every bit of the title bar itself: drag region, app identity, minimize/maximize/close. Always
 * mounted (App.tsx renders it above both the welcome screen and the main shell) so there's never
 * a state — including "no project open yet" — where the window can't be moved or closed.
 */
export default function TitleBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.api.windowControls.isMaximized().then(setMaximized)
    return window.api.windowControls.onMaximizeChange(setMaximized)
  }, [])

  return (
    <div
      className="app-drag flex h-9 shrink-0 items-center border-b border-base-700/60 bg-base-950"
      onDoubleClick={() => void window.api.windowControls.toggleMaximize()}
    >
      <div className="flex items-center gap-1.5 px-3 text-[11px] font-medium text-base-500">
        <Waypoints size={12} className="text-accent" />
        vibeIDE
      </div>
      <div className="flex-1" />
      <div className="app-no-drag flex h-full items-center">
        <button
          onClick={() => void window.api.windowControls.minimize()}
          title="Minimizar"
          className="flex h-full w-11 items-center justify-center text-base-400 transition-colors duration-150 ease-apple hover:bg-base-700/60 hover:text-base-100"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => void window.api.windowControls.toggleMaximize()}
          title={maximized ? 'Restaurar' : 'Maximizar'}
          className="flex h-full w-11 items-center justify-center text-base-400 transition-colors duration-150 ease-apple hover:bg-base-700/60 hover:text-base-100"
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          onClick={() => void window.api.windowControls.close()}
          title="Fechar"
          className="flex h-full w-11 items-center justify-center text-base-400 transition-colors duration-150 ease-apple hover:bg-danger hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
