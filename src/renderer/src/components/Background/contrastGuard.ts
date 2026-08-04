/**
 * Guarda de contraste (obrigatória, não é opt-in — docs/PLANO.md → FASE 2).
 * Samples the background's average color and, if L3 text over it would fall
 * below WCAG 4.5:1, raises --veil until it doesn't. Never blocks — it just
 * strengthens the veil and reports what it did.
 */
import { hexToRgb01, blendSrgb, relativeLuminance, contrastRatio } from './colorMath'

const PAPER_HEX = '#f5f5f7'
const SUBSTRATE_HEX = '#1c1c1e'
const MIN_CONTRAST = 4.5

export interface ContrastResult {
  /** average color sampled from the image, 0–1 sRGB */
  imageRgb: [number, number, number]
  /** minimum veil (0–1) needed to keep --paper text at/above 4.5:1 over the composited L1 */
  requiredVeil: number
}

/** Draws the image (already the small/blurred cached variant) into an offscreen 32×32 canvas and averages it. */
export async function sampleImageColor(url: string): Promise<[number, number, number]> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('failed to load image for contrast sampling'))
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return [0.5, 0.5, 0.5]
  ctx.drawImage(img, 0, 0, 32, 32)
  const { data } = ctx.getImageData(0, 0, 32, 32)

  let r = 0
  let g = 0
  let b = 0
  const pixels = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  return [r / pixels / 255, g / pixels / 255, b / pixels / 255]
}

export function requiredVeilForContrast(imageRgb: [number, number, number]): number {
  const substrate = hexToRgb01(SUBSTRATE_HEX)
  const paperLum = relativeLuminance(hexToRgb01(PAPER_HEX))

  // If even a fully-opaque veil (pure substrate, image fully hidden) can't reach
  // 4.5:1 against --paper, there's nothing more the veil alone can do — 1 is the
  // honest answer, not a silent failure.
  for (let v = 0; v <= 100; v++) {
    const veil = v / 100
    const blended = blendSrgb(substrate, imageRgb, veil)
    const ratio = contrastRatio(paperLum, relativeLuminance(blended))
    if (ratio >= MIN_CONTRAST) return veil
  }
  return 1
}

export async function computeContrastGuard(imageUrl: string): Promise<ContrastResult> {
  const imageRgb = await sampleImageColor(imageUrl)
  return { imageRgb, requiredVeil: requiredVeilForContrast(imageRgb) }
}
