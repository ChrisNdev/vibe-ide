/** Shared sRGB color helpers for the background system — contrast guard, duotone filter, terminal compositing. */

export function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [r, g, b]
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (c: number): string =>
    Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Blends two sRGB colors the way CSS opacity/backdrop compositing does — in gamma space, not linear light. */
export function blendSrgb(top: [number, number, number], bottom: [number, number, number], topAlpha: number): [number, number, number] {
  return [
    top[0] * topAlpha + bottom[0] * (1 - topAlpha),
    top[1] * topAlpha + bottom[1] * (1 - topAlpha),
    top[2] * topAlpha + bottom[2] * (1 - topAlpha)
  ]
}

function srgbToLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

export function contrastRatio(lumA: number, lumB: number): number {
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}
