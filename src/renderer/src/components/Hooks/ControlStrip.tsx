import { useEffect, useRef, useState } from 'react'

/**
 * "Tira de controle" — the design system's signature element (SISTEMA DE DESIGN →
 * Elemento assinatura). Full version reads context/tokens/git/erros (needs Fase
 * 5/8 data sources that don't exist yet); this is the "segundo consumidor" piece
 * Fase 4 asks for: UserPromptSubmit inks the strip, Stop snaps the registration
 * mark (⊕) into place.
 */
export default function ControlStrip(): JSX.Element {
  const [progress, setProgress] = useState(0)
  const [registered, setRegistered] = useState(true)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const off = window.api.hooks.onEvent((evt) => {
      if (evt.hook_event_name === 'UserPromptSubmit') {
        if (resetTimer.current) clearTimeout(resetTimer.current)
        if (holdTimer.current) clearTimeout(holdTimer.current)
        setRegistered(false)
        setProgress(reducedMotion ? 85 : 0)
        if (!reducedMotion) {
          holdTimer.current = setTimeout(() => setProgress(85), 30)
        }
      } else if (evt.hook_event_name === 'Stop') {
        if (holdTimer.current) clearTimeout(holdTimer.current)
        setProgress(100)
        setRegistered(true)
        resetTimer.current = setTimeout(() => setProgress(0), 700)
      }
    })
    return () => {
      off()
      if (resetTimer.current) clearTimeout(resetTimer.current)
      if (holdTimer.current) clearTimeout(holdTimer.current)
    }
  }, [])

  return (
    <div className="flex h-3 items-center gap-1.5 px-2" title="Tira de controle — entinta quando o agente trabalha, registra quando termina">
      <div className="h-1 w-16 overflow-hidden rounded-sm bg-base-800">
        <div
          className="h-full bg-ink-cyan transition-[width] duration-[2500ms] ease-linear"
          style={{ width: `${progress}%`, transitionDuration: progress === 100 || progress === 0 ? '80ms' : undefined }}
        />
      </div>
      <span className={`text-[10px] leading-none ${registered ? 'text-muted' : 'text-ink-yellow'}`}>⊕</span>
    </div>
  )
}
