import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface MoreMenuItem {
  label: string
  /** plain-language explanation of what this does — the whole point of grouping these here */
  description: string
  icon: LucideIcon
  active: boolean
  onSelect: () => void
}

interface MoreMenuProps {
  anchorRef: React.RefObject<HTMLElement>
  items: MoreMenuItem[]
  onClose: () => void
}

/** Anchored dropdown for the toolbar's secondary/advanced features — same outside-click + Escape pattern as ContextMenu. */
export default function MoreMenu({ anchorRef, items, onClose }: MoreMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
  }, [anchorRef])

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handlePointerDown, true)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose, anchorRef])

  if (!pos) return <></>

  return (
    <div
      ref={ref}
      className="surface fixed z-50 w-[280px] rounded-2xl border border-base-700/60 py-1.5 text-base-200 shadow-2xl animate-fade-in"
      style={{ top: pos.top, right: pos.right }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.onSelect()
            onClose()
          }}
          className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-base-700/40 ${
            item.active ? 'text-accent' : 'text-base-200'
          }`}
        >
          <item.icon size={16} className={`mt-0.5 shrink-0 ${item.active ? 'text-accent' : 'text-base-400'}`} />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium">{item.label}</span>
            <span className="block text-[11px] leading-snug text-base-500">{item.description}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
