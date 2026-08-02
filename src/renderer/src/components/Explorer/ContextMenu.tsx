import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface ContextMenuItem {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  danger?: boolean
  separatorBefore?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
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
  }, [onClose])

  const clampedX = Math.min(x, window.innerWidth - 200)
  const clampedY = Math.min(y, window.innerHeight - items.length * 30 - 16)

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-md bg-base-800 py-1 text-sm text-base-200 shadow-popover animate-fade-in"
      style={{ left: Math.max(4, clampedX), top: Math.max(4, clampedY) }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-base-700/60 ${
            item.separatorBefore ? 'mt-1 border-t border-base-700/60 pt-2' : ''
          } ${item.danger ? 'text-danger' : 'text-base-200'}`}
          onClick={() => {
            item.onSelect()
            onClose()
          }}
        >
          {item.icon ? <item.icon size={14} className="shrink-0" /> : null}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
