import { useEffect, useMemo, useRef } from 'react'
import { useBackgroundStore } from '@renderer/store/backgroundStore'
import { sampleImageColor, requiredVeilForContrast } from './contrastGuard'
import { hexToRgb01 } from './colorMath'
import ProceduralBackground from './ProceduralBackground'

/** Maps L0's luminance onto --substrate → --spot, so any photo enters the app's ink palette. */
function DuotoneFilter({ spot }: { spot: string }): JSX.Element {
  const substrate = hexToRgb01('#1c1c1e')
  const [sr, sg, sb] = spot ? hexToRgb01(spot) : [0.77, 0.27, 0.5]
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="vibe-duotone">
        <feColorMatrix
          type="matrix"
          values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
        />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={`${substrate[0]} ${sr}`} />
          <feFuncG type="table" tableValues={`${substrate[1]} ${sg}`} />
          <feFuncB type="table" tableValues={`${substrate[2]} ${sb}`} />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}

export default function BackgroundLayer(): JSX.Element | null {
  const config = useBackgroundStore((s) => s.config)
  const loaded = useBackgroundStore((s) => s.loaded)
  const blurredUrl = useBackgroundStore((s) => s.blurredUrl())
  const setConfig = useBackgroundStore((s) => s.setConfig)
  const setContrastNotice = useBackgroundStore((s) => s.setContrastNotice)
  const setAvgColor = useBackgroundStore((s) => s.setAvgColor)
  const lastSampledRef = useRef<string | null>(null)

  const sampleKey = config.kind === 'image' ? blurredUrl : config.kind === 'gradient' ? `${config.gradientFrom}|${config.gradientTo}` : config.kind === 'solid' ? config.solidColor : null

  // --surface-alpha only exists as a static :root fallback in background.css — nothing else
  // pushed the "Opacidade das superfícies" slider's actual value into it, so every .surface
  // panel (sidebar, terminal, all the settings panels) silently ignored the setting entirely.
  useEffect(() => {
    document.documentElement.style.setProperty('--surface-alpha', String(config.surfaceAlpha))
  }, [config.surfaceAlpha])

  // Guarda de contraste — obrigatória, sempre roda (não é gated pelo toggle
  // "Contraste garantido": esse toggle é travado em ligado na UI, ver BackgroundSettings).
  // Also feeds avgColor, which the terminal uses to compute its own solid background color.
  useEffect(() => {
    if (!loaded || config.kind === 'none' || config.kind === 'procedural' || !sampleKey) {
      if (config.kind === 'none' || config.kind === 'procedural') setAvgColor(null)
      return
    }
    if (lastSampledRef.current === sampleKey) return
    lastSampledRef.current = sampleKey

    let cancelled = false
    ;(async () => {
      let imageRgb: [number, number, number]
      if (config.kind === 'image' && blurredUrl) {
        imageRgb = await sampleImageColor(blurredUrl)
      } else if (config.kind === 'gradient') {
        const [r1, g1, b1] = hexToRgb01(config.gradientFrom)
        const [r2, g2, b2] = hexToRgb01(config.gradientTo)
        imageRgb = [(r1 + r2) / 2, (g1 + g2) / 2, (b1 + b2) / 2]
      } else {
        imageRgb = hexToRgb01(config.solidColor)
      }
      if (cancelled) return
      setAvgColor(imageRgb)
      const requiredVeil = requiredVeilForContrast(imageRgb)
      if (requiredVeil > config.veil) {
        setContrastNotice(`Véu ajustado pra ${Math.round(requiredVeil * 100)}% — a imagem é clara demais.`)
        void setConfig({ veil: requiredVeil })
      } else {
        setContrastNotice(null)
      }
    })().catch(() => {
      if (!cancelled) setContrastNotice(null)
    })

    return () => {
      cancelled = true
    }
  }, [loaded, config.kind, sampleKey, blurredUrl, config.veil, config.gradientFrom, config.gradientTo, config.solidColor, setConfig, setContrastNotice, setAvgColor])

  const l0Style = useMemo(() => {
    switch (config.kind) {
      case 'image':
        return blurredUrl ? { backgroundImage: `url(${blurredUrl})`, filter: 'url(#vibe-duotone)' } : undefined
      case 'gradient':
        return { background: `linear-gradient(160deg, ${config.gradientFrom}, ${config.gradientTo})` }
      case 'solid':
        return { background: config.solidColor }
      default:
        return undefined
    }
  }, [config.kind, config.gradientFrom, config.gradientTo, config.solidColor, blurredUrl])

  if (!loaded || config.kind === 'none') return null

  return (
    <>
      <DuotoneFilter spot={config.spot} />
      <div className="bg-l0" style={l0Style}>
        {config.kind === 'procedural' && config.proceduralId && <ProceduralBackground id={config.proceduralId} />}
      </div>
      <div className="bg-l1" style={{ opacity: config.veil }} />
    </>
  )
}
