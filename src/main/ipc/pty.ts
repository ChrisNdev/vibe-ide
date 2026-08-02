import { ipcMain, BrowserWindow } from 'electron'
import { IPC, PtySpawnOptions } from '../../shared/types'
import { spawnPty, writePty, resizePty, killPty, detectShells } from '../pty-manager'

export function registerPtyHandlers(): void {
  ipcMain.handle(IPC.PTY_SPAWN, async (e, opts: PtySpawnOptions) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    spawnPty(win, opts)
  })

  ipcMain.handle(IPC.PTY_WRITE, async (_e, id: string, data: string) => {
    writePty(id, data)
  })

  ipcMain.handle(IPC.PTY_RESIZE, async (_e, id: string, cols: number, rows: number) => {
    resizePty(id, cols, rows)
  })

  ipcMain.handle(IPC.PTY_KILL, async (_e, id: string) => {
    killPty(id)
  })

  ipcMain.handle(IPC.SHELLS_DETECT, async () => {
    return detectShells()
  })
}
