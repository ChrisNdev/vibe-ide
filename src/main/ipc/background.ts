import { ipcMain, dialog, BrowserWindow, screen } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import {
  IPC,
  BackgroundConfig,
  BackgroundImageResult,
  ThemeFile,
  ThemeExportResult,
  ThemeImportResult
} from '../../shared/types'
import {
  processNewImage,
  importImageFromBase64,
  regenerateVariants,
  clearBackgroundFiles,
  readOriginalAsBase64,
  ProcessParams
} from '../background-processor'

const MAX_CACHE_DIMENSION = 2560

/** Caches the background at (roughly) screen size, capped so a 4K/5K/8K display doesn't balloon the cache. */
function targetSize(): { targetWidth: number; targetHeight: number } {
  const { width, height } = screen.getPrimaryDisplay().size
  const scale = Math.min(1, MAX_CACHE_DIMENSION / Math.max(width, height))
  return { targetWidth: Math.round(width * scale), targetHeight: Math.round(height * scale) }
}

function paramsFromBackground(bg: Pick<BackgroundConfig, 'blur' | 'brightness' | 'saturation'>): ProcessParams {
  return { ...targetSize(), blurPx: bg.blur, brightness: bg.brightness, saturation: bg.saturation }
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif']

export function registerBackgroundHandlers(): void {
  ipcMain.handle(
    IPC.BACKGROUND_PICK_IMAGE,
    async (e, bg: Pick<BackgroundConfig, 'blur' | 'brightness' | 'saturation'>): Promise<BackgroundImageResult | null> => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return null
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: 'Imagens', extensions: IMAGE_EXTENSIONS }]
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return processNewImage(result.filePaths[0], paramsFromBackground(bg))
    }
  )

  ipcMain.handle(
    IPC.BACKGROUND_REMOVE,
    async (): Promise<void> => {
      await clearBackgroundFiles()
    }
  )

  // Debounced from the renderer when the blur/brightness/saturation sliders move —
  // re-renders the cached variants from the stored original, never a live CSS filter.
  ipcMain.handle(
    IPC.BACKGROUND_REGENERATE,
    async (_e, id: string, bg: Pick<BackgroundConfig, 'blur' | 'brightness' | 'saturation'>): Promise<BackgroundImageResult | null> => {
      return regenerateVariants(id, paramsFromBackground(bg))
    }
  )

  ipcMain.handle(
    IPC.THEME_EXPORT,
    async (e, name: string, tokens: Record<string, string>, background: BackgroundConfig): Promise<ThemeExportResult> => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return { ok: false, error: 'Sem janela ativa.' }
      const result = await dialog.showSaveDialog(win, {
        defaultPath: `${name || 'vibeIDE'}.vibe-theme.json`,
        filters: [{ name: 'Tema vibeIDE', extensions: ['vibe-theme.json'] }]
      })
      if (result.canceled || !result.filePath) return { ok: false, error: 'Exportação cancelada.' }

      let imageBase64: string | null = null
      let imageExt: string | null = null
      if (background.kind === 'image' && background.imageId) {
        const original = await readOriginalAsBase64(background.imageId)
        if (original) {
          imageBase64 = original.base64
          imageExt = original.ext
        }
      }

      const { imageId: _imageId, ...backgroundWithoutId } = background
      const file: ThemeFile = {
        version: 1,
        name: name || 'Tema sem nome',
        tokens,
        background: { ...backgroundWithoutId, imageBase64, imageExt }
      }

      try {
        await fs.writeFile(result.filePath, JSON.stringify(file, null, 2), 'utf-8')
        return { ok: true, path: result.filePath }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle(IPC.THEME_IMPORT, async (e): Promise<ThemeImportResult> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return { ok: false, error: 'Sem janela ativa.' }
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Tema vibeIDE', extensions: ['json'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false, error: 'Importação cancelada.' }

    try {
      const raw = await fs.readFile(result.filePaths[0], 'utf-8')
      const parsed = JSON.parse(raw) as Partial<ThemeFile>
      if (parsed.version !== 1 || !parsed.background) {
        return { ok: false, error: 'Arquivo de tema inválido ou de uma versão não suportada.' }
      }

      const { imageBase64, imageExt, ...backgroundRest } = parsed.background
      let background: BackgroundConfig = { ...backgroundRest, imageId: null }

      if (background.kind === 'image' && imageBase64) {
        const ext = imageExt || path.extname('.png')
        const image = await importImageFromBase64(imageBase64, ext, paramsFromBackground(background))
        background = { ...background, imageId: image.id }
      }

      return { ok: true, name: parsed.name, tokens: parsed.tokens ?? {}, background }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
