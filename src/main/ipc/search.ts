import { ipcMain, BrowserWindow } from 'electron'
import path from 'path'
import { IPC, SearchOptions } from '../../shared/types'
import { runSearch, cancelSearch, listFiles } from '../search-runner'

export function registerSearchHandlers(): void {
  ipcMain.handle(IPC.SEARCH_RUN, async (e, rootPath: string, opts: SearchOptions) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    runSearch(
      win.id,
      rootPath,
      opts,
      (matches) => {
        if (!win.isDestroyed()) win.webContents.send(IPC.SEARCH_RESULT, matches)
      },
      (total, truncated, cancelled) => {
        if (!win.isDestroyed()) win.webContents.send(IPC.SEARCH_DONE, { total, truncated, cancelled })
      }
    )
  })

  ipcMain.handle(IPC.SEARCH_CANCEL, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) cancelSearch(win.id)
  })

  ipcMain.handle(IPC.SEARCH_LIST_FILES, async (_e, rootPath: string): Promise<string[]> => {
    const files = await listFiles(rootPath)
    return files.map((rel) => path.join(rootPath, rel))
  })
}
