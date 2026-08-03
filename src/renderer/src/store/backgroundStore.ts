import { create } from 'zustand'
import type { BackgroundConfig, ThemeExportResult, ThemeImportResult } from '@shared/types'
import { PRESETS } from '@renderer/components/Background/presets'
import { hexToRgb01, blendSrgb, rgbToHex } from '@renderer/components/Background/colorMath'

const SUBSTRATE_RGB = hexToRgb01('#141210')
const PANEL_RGB = hexToRgb01('#1c1a18')

export const DEFAULT_BACKGROUND: BackgroundConfig = {
  kind: 'none',
  imageId: null,
  gradientFrom: '#141210',
  gradientTo: '#2a2724',
  solidColor: '#141210',
  proceduralId: null,
  blur: 24,
  brightness: 1,
  saturation: 1,
  veil: 0.72,
  surfaceAlpha: 0.78,
  spot: '#c4457f',
  contrastGuaranteed: true,
  terminalTranslucent: false,
  useSystemWallpaper: false
}

/** --panel/--ink-* aren't user-editable yet, but a theme file snapshots them so it stays a faithful, shareable export. */
const TOKEN_KEYS = [
  '--ink-cyan',
  '--ink-magenta',
  '--ink-yellow',
  '--ink-overprint',
  '--substrate',
  '--panel',
  '--rule',
  '--paper',
  '--muted'
]

export function readCurrentTokens(): Record<string, string> {
  const computed = getComputedStyle(document.documentElement)
  const tokens: Record<string, string> = {}
  for (const key of TOKEN_KEYS) tokens[key] = computed.getPropertyValue(key).trim()
  return tokens
}

function applyTokens(tokens: Record<string, string>): void {
  for (const [key, value] of Object.entries(tokens)) {
    if (value) document.documentElement.style.setProperty(key, value)
  }
}

/** Cache-busting query so a regenerated file (same name, new bytes) isn't served stale from Chromium's HTTP cache. */
function withVersion(url: string, version: number): string {
  return `${url}?v=${version}`
}

interface BackgroundState {
  config: BackgroundConfig
  imageWidth: number | null
  imageHeight: number | null
  /** bumped on every regenerate() so cached vibe:// URLs bust correctly */
  version: number
  loaded: boolean
  /** set by the contrast guard when it had to raise --veil above config.veil */
  contrastNotice: string | null
  /** average color behind L1 (sampled image, or gradient midpoint / solid) — feeds the terminal's computed background */
  avgColor: [number, number, number] | null

  load: () => Promise<void>
  setConfig: (patch: Partial<BackgroundConfig>) => Promise<void>
  pickImage: () => Promise<void>
  removeBackground: () => Promise<void>
  selectPreset: (id: string) => Promise<void>
  resetToDefault: () => Promise<void>
  setContrastNotice: (notice: string | null) => void
  setAvgColor: (rgb: [number, number, number] | null) => void
  exportTheme: (name: string) => Promise<ThemeExportResult>
  importTheme: () => Promise<ThemeImportResult>
  fullUrl: () => string | null
  blurredUrl: () => string | null
  /**
   * Computed L2-equivalent color for the terminal's OWN background (theme.background)
   * — the canvas stays opaque/WebGL, so it can't show the veil through it like a
   * DOM surface does; instead it's painted the exact composited color in JS.
   */
  terminalBackgroundHex: () => string
}

let regenerateTimer: ReturnType<typeof setTimeout> | null = null

export const useBackgroundStore = create<BackgroundState>((set, get) => ({
  config: DEFAULT_BACKGROUND,
  imageWidth: null,
  imageHeight: null,
  version: 0,
  loaded: false,
  contrastNotice: null,
  avgColor: null,

  load: async () => {
    const settings = await window.api.settings.get()
    set({ config: settings.background ?? DEFAULT_BACKGROUND, loaded: true })
  },

  setConfig: async (patch) => {
    const next = { ...get().config, ...patch }
    set({ config: next })
    await window.api.settings.set({ background: next })

    const sliderChanged = 'blur' in patch || 'brightness' in patch || 'saturation' in patch
    if (sliderChanged && next.kind === 'image' && next.imageId) {
      if (regenerateTimer) clearTimeout(regenerateTimer)
      const imageId = next.imageId
      regenerateTimer = setTimeout(() => {
        void window.api.background.regenerate(imageId, next).then((result) => {
          if (result) set((s) => ({ version: s.version + 1, imageWidth: result.width, imageHeight: result.height }))
        })
      }, 250)
    }
  },

  pickImage: async () => {
    const { config } = get()
    const result = await window.api.background.pickImage(config)
    if (!result) return
    set((s) => ({ version: s.version + 1, imageWidth: result.width, imageHeight: result.height }))
    await get().setConfig({ kind: 'image', imageId: result.id })
  },

  removeBackground: async () => {
    await window.api.background.remove()
    set({ imageWidth: null, imageHeight: null, contrastNotice: null })
    await get().setConfig({ kind: 'none', imageId: null, proceduralId: null })
  },

  selectPreset: async (id) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    if (get().config.kind === 'image') await window.api.background.remove()
    await get().setConfig(preset.config)
  },

  resetToDefault: async () => {
    if (get().config.kind === 'image') await window.api.background.remove()
    set({ imageWidth: null, imageHeight: null, contrastNotice: null })
    await get().setConfig(DEFAULT_BACKGROUND)
  },

  setContrastNotice: (notice) => set({ contrastNotice: notice }),
  setAvgColor: (rgb) => set({ avgColor: rgb }),

  exportTheme: async (name) => {
    const { config } = get()
    return window.api.theme.export(name, readCurrentTokens(), config)
  },

  importTheme: async () => {
    const result = await window.api.theme.import()
    if (result.ok) {
      if (result.tokens) applyTokens(result.tokens)
      if (result.background) {
        set((s) => ({ config: result.background as BackgroundConfig, version: s.version + 1 }))
        await window.api.settings.set({ background: result.background })
      }
    }
    return result
  },

  fullUrl: () => {
    const { config, version } = get()
    if (config.kind !== 'image' || !config.imageId) return null
    return withVersion(`vibe://bg/${config.imageId}-full.webp`, version)
  },
  blurredUrl: () => {
    const { config, version } = get()
    if (config.kind !== 'image' || !config.imageId) return null
    return withVersion(`vibe://bg/${config.imageId}-blurred.webp`, version)
  },

  terminalBackgroundHex: () => {
    const { config, avgColor } = get()
    if (config.kind === 'none') return '#141210'
    const backdrop = avgColor ?? SUBSTRATE_RGB
    const veiled = blendSrgb(SUBSTRATE_RGB, backdrop, config.veil)
    const surface = blendSrgb(PANEL_RGB, veiled, config.surfaceAlpha)
    return rgbToHex(surface)
  }
}))
