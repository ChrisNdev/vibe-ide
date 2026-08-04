import { useEffect, useRef } from 'react'
import { PartyPopper, X } from 'lucide-react'
import type { PendingPatchNotes } from '@shared/types'

interface PatchNotesModalProps {
  patchNotes: PendingPatchNotes
  onClose: () => void
  /** "Atualizado para vX" after a fresh update (default) vs. "Notas da versão vX" when opened on demand */
  heading?: 'updated' | 'notes'
}

export default function PatchNotesModal({ patchNotes, onClose, heading = 'updated' }: PatchNotesModalProps): JSX.Element {
  const { version, notes, releaseUrl } = patchNotes
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-substrate/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="surface flex max-h-[70vh] w-[540px] flex-col overflow-hidden rounded-2xl border border-base-700/60 text-base-200 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base-700/60 px-5 py-4">
          <span className="flex items-center gap-2 text-[14px] font-semibold text-base-100">
            <PartyPopper size={16} className="text-ink-yellow" />
            {heading === 'updated' ? `Atualizado para v${version}` : `Notas da versão v${version}`}
          </span>
          <button
            className="rounded-full p-1.5 text-base-400 transition-colors duration-150 ease-apple hover:bg-base-700/60 hover:text-base-100"
            onClick={onClose}
            title="Fechar (Esc)"
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[13px] leading-relaxed">
          {notes ? (
            <pre className="whitespace-pre-wrap font-sans text-base-300">{notes}</pre>
          ) : (
            <p className="text-base-400">
              Sem notas de versão disponíveis.
              {releaseUrl && (
                <>
                  {' '}
                  <button className="text-accent hover:text-accent-bright" onClick={() => void window.api.app.openExternal(releaseUrl)}>
                    Ver a release no GitHub
                  </button>
                  .
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex justify-end border-t border-base-700/60 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-full bg-accent px-4 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 ease-apple hover:bg-accent-bright"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
