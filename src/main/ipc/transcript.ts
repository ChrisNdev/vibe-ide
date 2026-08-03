import { ipcMain, BrowserWindow } from 'electron'
import { IPC, TranscriptSessionSummary } from '../../shared/types'
import { watchSession, unwatchSession, listSessions } from '../transcript-tailer'

export function registerTranscriptHandlers(): void {
  ipcMain.handle(IPC.TRANSCRIPT_WATCH, async (e, rootPath: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return { ok: false }
    return watchSession(win.id, rootPath, (state) => {
      if (!win.isDestroyed()) win.webContents.send(IPC.TRANSCRIPT_UPDATE, state)
    })
  })

  ipcMain.handle(IPC.TRANSCRIPT_UNWATCH, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) unwatchSession(win.id)
  })

  ipcMain.handle(IPC.TRANSCRIPT_LIST_SESSIONS, async (_e, rootPath: string): Promise<TranscriptSessionSummary[]> => {
    return listSessions(rootPath)
  })
}
