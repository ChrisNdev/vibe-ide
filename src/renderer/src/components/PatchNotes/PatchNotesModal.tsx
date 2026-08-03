import { PartyPopper, X } from 'lucide-react'
import type { PendingPatchNotes } from '@shared/types'

interface PatchNotesModalProps {
  patchNotes: PendingPatchNotes
  onClose: () => void
}

export default function PatchNotesModal({ patchNotes, onClose }: PatchNotesModalProps): JSX.Element {
  const { version, notes, releaseUrl } = patchNotes

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-substrate/60" onClick={onClose}>
      <div
        className="surface flex max-h-[70vh] w-[520px] flex-col rounded border border-rule bg-panel text-base-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <span className="flex items-center gap-2 font-medium text-base-100">
            <PartyPopper size={15} className="text-ink-yellow" />
            Atualizado para v{version}
          </span>
          <button className="rounded p-1 text-base-400 hover:bg-base-700/60" onClick={onClose} title="Fechar">
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed">
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
        <div className="flex justify-end border-t border-rule px-4 py-2.5">
          <button onClick={onClose} className="rounded bg-accent px-3 py-1.5 text-[12px] font-medium text-base-950 hover:bg-accent-bright">
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
