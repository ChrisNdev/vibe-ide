import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import { app, protocol } from 'electron'
import sharp from 'sharp'
import { BackgroundImageResult } from '../shared/types'

/**
 * Background images live at userData/backgrounds/, never in the project workspace.
 * Only one background is active at a time — clearBackgroundFiles() wipes the
 * directory before a new image is stored so it can't grow unbounded.
 */
function backgroundsDir(): string {
  return path.join(app.getPath('userData'), 'backgrounds')
}

async function ensureDir(): Promise<string> {
  const dir = backgroundsDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export interface ProcessParams {
  targetWidth: number
  targetHeight: number
  /** px — baked into the cached "blurred" variant via sharp, never a live CSS filter */
  blurPx: number
  /** sharp modulate() multiplier, 0–2 */
  brightness: number
  /** sharp modulate() multiplier, 0–2 */
  saturation: number
}

function toUrls(id: string): Pick<BackgroundImageResult, 'fullUrl' | 'blurredUrl'> {
  return {
    fullUrl: `vibe://bg/${id}-full.webp`,
    blurredUrl: `vibe://bg/${id}-blurred.webp`
  }
}

/** Re-renders the "full" (resized) and "blurred" (resized + blurred) cached variants from a stored original. */
async function renderVariants(originalPath: string, id: string, params: ProcessParams): Promise<BackgroundImageResult> {
  const dir = await ensureDir()
  const meta = await sharp(originalPath).metadata()

  const base = () =>
    sharp(originalPath)
      .rotate() // auto-orient from EXIF before anything else touches pixel dimensions
      .resize({ width: params.targetWidth, height: params.targetHeight, fit: 'cover' })
      .modulate({ brightness: params.brightness, saturation: params.saturation })

  await base().webp({ quality: 82 }).toFile(path.join(dir, `${id}-full.webp`))
  await base()
    .blur(Math.max(0.3, params.blurPx / 2))
    .webp({ quality: 70 })
    .toFile(path.join(dir, `${id}-blurred.webp`))

  return { id, width: meta.width ?? params.targetWidth, height: meta.height ?? params.targetHeight, ...toUrls(id) }
}

export async function clearBackgroundFiles(): Promise<void> {
  const dir = await ensureDir()
  const entries = await fs.readdir(dir)
  await Promise.all(entries.map((f) => fs.unlink(path.join(dir, f)).catch(() => {})))
}

async function storeOriginal(buffer: Buffer, ext: string): Promise<{ id: string; originalPath: string }> {
  const dir = await ensureDir()
  const id = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
  const originalPath = path.join(dir, `${id}-original${ext}`)
  await fs.writeFile(originalPath, buffer)
  return { id, originalPath }
}

export async function processNewImage(sourcePath: string, params: ProcessParams): Promise<BackgroundImageResult> {
  const buffer = await fs.readFile(sourcePath)
  const ext = path.extname(sourcePath).toLowerCase() || '.png'
  await clearBackgroundFiles()
  const { id, originalPath } = await storeOriginal(buffer, ext)
  return renderVariants(originalPath, id, params)
}

export async function importImageFromBase64(base64: string, ext: string, params: ProcessParams): Promise<BackgroundImageResult> {
  const buffer = Buffer.from(base64, 'base64')
  await clearBackgroundFiles()
  const { id, originalPath } = await storeOriginal(buffer, ext || '.png')
  return renderVariants(originalPath, id, params)
}

/** Used when a slider (blur/brightness/saturation) changes — re-renders from the already-stored original, no re-copy. */
export async function regenerateVariants(id: string, params: ProcessParams): Promise<BackgroundImageResult | null> {
  const dir = await ensureDir()
  const entries = await fs.readdir(dir)
  const originalName = entries.find((f) => f.startsWith(`${id}-original`))
  if (!originalName) return null
  return renderVariants(path.join(dir, originalName), id, params)
}

export async function readOriginalAsBase64(id: string): Promise<{ base64: string; ext: string } | null> {
  const dir = await ensureDir()
  const entries = await fs.readdir(dir)
  const originalName = entries.find((f) => f.startsWith(`${id}-original`))
  if (!originalName) return null
  const buffer = await fs.readFile(path.join(dir, originalName))
  return { base64: buffer.toString('base64'), ext: path.extname(originalName) }
}

const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif'
}

/**
 * Serves userData/backgrounds/ files to the renderer as vibe://bg/<filename> —
 * file:// doesn't resolve with sandbox: true, so the app needs its own scheme.
 * Must be registered as privileged (protocol.registerSchemesAsPrivileged) before
 * app is ready; this handler is wired up after.
 */
export function registerBackgroundProtocol(): void {
  protocol.handle('vibe', async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'bg') return new Response('not found', { status: 404 })
      const filename = decodeURIComponent(url.pathname.replace(/^\//, ''))
      const dir = await ensureDir()
      const resolved = path.resolve(dir, filename)
      const rel = path.relative(dir, resolved)
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return new Response('forbidden', { status: 403 })
      }
      const data = await fs.readFile(resolved)
      const mime = MIME_BY_EXT[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream'
      // CORS header needed for <img crossorigin> (contrast-guard canvas sampling) to
      // read pixel data across the vibe:// / file:// scheme boundary without tainting.
      return new Response(data, { headers: { 'content-type': mime, 'access-control-allow-origin': '*' } })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}
