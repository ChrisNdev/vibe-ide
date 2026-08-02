import { ipcMain, shell, clipboard, dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { IPC, FileEntry, FileReadResult } from '../../shared/types'
import { watchPath, unwatchPath } from '../file-watcher'

/** Above this, we don't even try to read the file into the preview pane — avoids choking the renderer on huge assets/logs. */
const MAX_PREVIEW_SIZE = 2 * 1024 * 1024

function looksBinary(buffer: Buffer): boolean {
  const sampleLength = Math.min(buffer.length, 8000)
  for (let i = 0; i < sampleLength; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

export function registerFsHandlers(): void {
  ipcMain.handle(IPC.DIALOG_OPEN_FOLDER, async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.FS_READ_DIR, async (_e, dirPath: string): Promise<FileEntry[]> => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const mapped = entries.map((entry) => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
      isSymlink: entry.isSymbolicLink()
    }))
    mapped.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    return mapped
  })

  ipcMain.handle(IPC.FS_CREATE_FILE, async (_e, filePath: string) => {
    const handle = await fs.open(filePath, 'wx')
    await handle.close()
  })

  ipcMain.handle(IPC.FS_CREATE_DIR, async (_e, dirPath: string) => {
    await fs.mkdir(dirPath, { recursive: false })
  })

  ipcMain.handle(IPC.FS_RENAME, async (_e, oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath)
  })

  ipcMain.handle(IPC.FS_DELETE, async (_e, targetPath: string) => {
    await shell.trashItem(targetPath)
  })

  ipcMain.handle(IPC.FS_DUPLICATE, async (_e, sourcePath: string) => {
    const dir = path.dirname(sourcePath)
    const ext = path.extname(sourcePath)
    const base = path.basename(sourcePath, ext)
    let candidate = path.join(dir, `${base} copy${ext}`)
    let i = 2
    while (fsSync.existsSync(candidate)) {
      candidate = path.join(dir, `${base} copy ${i}${ext}`)
      i++
    }
    const stat = await fs.stat(sourcePath)
    if (stat.isDirectory()) {
      await fs.cp(sourcePath, candidate, { recursive: true })
    } else {
      await fs.copyFile(sourcePath, candidate)
    }
    return candidate
  })

  ipcMain.handle(IPC.FS_MOVE, async (_e, sourcePath: string, destDir: string) => {
    const dest = path.join(destDir, path.basename(sourcePath))
    await fs.rename(sourcePath, dest)
    return dest
  })

  ipcMain.handle(IPC.FS_REVEAL, async (_e, targetPath: string) => {
    shell.showItemInFolder(targetPath)
  })

  ipcMain.handle(IPC.FS_WATCH, async (e, rootPath: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) watchPath(win, rootPath)
  })

  ipcMain.handle(IPC.FS_UNWATCH, async (_e, rootPath: string) => {
    unwatchPath(rootPath)
  })

  ipcMain.handle(IPC.CLIPBOARD_WRITE, async (_e, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle(IPC.FS_READ_FILE, async (_e, filePath: string): Promise<FileReadResult> => {
    try {
      const stat = await fs.stat(filePath)
      if (stat.size > MAX_PREVIEW_SIZE) {
        return { content: '', size: stat.size, truncated: true, binary: false }
      }
      const buffer = await fs.readFile(filePath)
      if (looksBinary(buffer)) {
        return { content: '', size: stat.size, truncated: false, binary: true }
      }
      return { content: buffer.toString('utf-8'), size: stat.size, truncated: false, binary: false }
    } catch {
      return { content: '', size: 0, truncated: false, binary: false }
    }
  })
}
