import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'

/** Custom title bar (see src/renderer/src/components/TitleBar) drives min/max/close itself — window
 * is fully frameless (no titleBarOverlay), so these are the only way to control it besides dragging. */
export function registerWindowHandlers(): void {
  ipcMain.handle(IPC.WINDOW_MINIMIZE, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })

  ipcMain.handle(IPC.WINDOW_TOGGLE_MAXIMIZE, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle(IPC.WINDOW_CLOSE, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
  })

  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, (e): boolean => {
    return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false
  })
}
