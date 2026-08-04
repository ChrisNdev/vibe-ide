import { useEffect, useState } from 'react'
import { useActivityStore } from '@renderer/store/activityStore'

/** Claude's standard context window (Sonnet/Opus). Accounts with the 1M beta will read low — no per-account limit is exposed anywhere to know better. */
const CONTEXT_WINDOW = 200_000

/**
 * "Tira de controle" — the design system's signature element. Fill now tracks real
 * context-window usage from the live transcript (input + cache tokens of the latest
 * turn) instead of a decorative pulse; the ⊕ mark still flips while the agent is
 * mid-turn (UserPromptSubmit → Stop) so "is Claude working" stays visible at a glance.
 */
export default function ControlStrip(): JSX.Element {
  const [registered, setRegistered] = useState(true)
  const usage = useActivityStore((s) => s.transcript?.usage)

  useEffect(() => {
    return window.api.hooks.onEvent((evt) => {
      if (evt.hook_event_name === 'UserPromptSubmit') setRegistered(false)
      else if (evt.hook_event_name === 'Stop') setRegistered(true)
    })
  }, [])

  const last = usage && usage.length > 0 ? usage[usage.length - 1] : null
  const tokensUsed = last ? last.inputTokens + last.cacheCreationTokens + last.cacheReadTokens : 0
  const percent = Math.min(100, Math.round((tokensUsed / CONTEXT_WINDOW) * 100))
  const barColor = percent >= 90 ? 'bg-danger' : percent >= 70 ? 'bg-ink-yellow' : 'bg-ink-cyan'

  return (
    <div
      className="flex h-3 items-center gap-1.5 px-2"
      title={
        last
          ? `Contexto usado: ${tokensUsed.toLocaleString('pt-BR')} / ${CONTEXT_WINDOW.toLocaleString('pt-BR')} tokens (${percent}%)`
          : 'Contexto — nenhuma atividade ainda nesta sessão'
      }
    >
      <div className="h-1 w-16 overflow-hidden rounded-sm bg-base-800">
        <div className={`h-full ${barColor} transition-[width] duration-300 ease-apple`} style={{ width: `${percent}%` }} />
      </div>
      <span className="tabular-nums text-[10px] leading-none text-base-500">{percent}%</span>
      <span className={`text-[10px] leading-none ${registered ? 'text-muted' : 'text-ink-yellow'}`}>⊕</span>
    </div>
  )
}
