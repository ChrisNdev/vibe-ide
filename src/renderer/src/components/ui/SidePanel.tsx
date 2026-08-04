import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface SidePanelProps {
  title: string
  icon?: LucideIcon
  onClose: () => void
  width?: number
  children: React.ReactNode
}

/**
 * Every settings/inspector-style panel in the app shares this chrome. Escape-to-close lives
 * here once, not copy-pasted per panel — the previous per-panel approach meant most of them
 * (Worktree, Mcp, Hooks, Checkpoints, Background) simply never wired it up.
 */
export default function SidePanel({ title, icon: Icon, onClose, width = 400, children }: SidePanelProps): JSX.Element {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div
      // top-12, not the inset-y-3 shorthand — Windows draws its native minimize/maximize/close
      // buttons as a real overlay over the top titleBarOverlay.height (36px, see src/main/index.ts),
      // so anything closer to the top than that renders/clicks underneath them.
      className="surface fixed top-12 bottom-3 right-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-base-700/60 text-base-200 shadow-2xl animate-slide-up"
      style={{ width }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-base-700/60 px-4 py-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-base-100">
          {Icon && <Icon size={14} className="text-accent" />}
          {title}
        </span>
        <button
          className="rounded-full p-1.5 text-base-400 transition-colors duration-150 ease-apple hover:bg-base-700/60 hover:text-base-100"
          onClick={onClose}
          title="Fechar (Esc)"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
