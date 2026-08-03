import type { BackgroundConfig } from '@shared/types'

export interface BackgroundPreset {
  id: string
  label: string
  config: Partial<BackgroundConfig>
}

/**
 * Shipped presets — generated procedurally (CSS/SVG) rather than raster files, so
 * there's no image to source/license/ship. "Sólido" needs no L0 media at all.
 */
export const PRESETS: BackgroundPreset[] = [
  { id: 'proof-strip', label: 'Folha de prova', config: { kind: 'procedural', proceduralId: 'proof-strip', imageId: null } },
  { id: 'halftone', label: 'Retícula meio-tom', config: { kind: 'procedural', proceduralId: 'halftone', imageId: null } },
  { id: 'registration', label: 'Marcas de registro', config: { kind: 'procedural', proceduralId: 'registration', imageId: null } },
  { id: 'kraft', label: 'Papel kraft', config: { kind: 'procedural', proceduralId: 'kraft', imageId: null } },
  { id: 'solid', label: 'Sólido', config: { kind: 'solid', proceduralId: null, imageId: null } }
]
