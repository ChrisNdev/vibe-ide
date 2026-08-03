import { ipcMain, BrowserWindow } from 'electron'
import { IPC, PackageScript, DiagnosticsResult, ConsoleErrorEntry } from '../../shared/types'
import { listScripts, runScript, stopScript } from '../script-runner'
import { runDiagnostics } from '../diagnostics-runner'
import { consoleErrorLog } from '../console-error-log'

export function registerVerificationHandlers(): void {
  ipcMain.handle(IPC.SCRIPTS_LIST, async (_e, rootPath: string): Promise<PackageScript[]> => {
    return listScripts(rootPath)
  })

  ipcMain.handle(IPC.SCRIPTS_RUN, async (e, rootPath: string, scriptName: string): Promise<string> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return ''
    return runScript(
      win.id,
      rootPath,
      scriptName,
      (runId, text, stream) => {
        if (!win.isDestroyed()) win.webContents.send(IPC.SCRIPTS_OUTPUT, { runId, text, stream })
      },
      (runId, event) => {
        if (!win.isDestroyed()) win.webContents.send(IPC.SCRIPTS_STATUS, { runId, ...event })
      }
    )
  })

  ipcMain.handle(IPC.SCRIPTS_STOP, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) stopScript(win.id)
  })

  ipcMain.handle(IPC.DIAGNOSTICS_RUN, async (_e, rootPath: string): Promise<DiagnosticsResult> => {
    return runDiagnostics(rootPath)
  })

  ipcMain.handle(IPC.CONSOLE_ERROR_REPORT, async (_e, entry: ConsoleErrorEntry) => {
    consoleErrorLog.add(entry)
  })

  ipcMain.handle(IPC.CONSOLE_ERRORS_CLEAR, async () => {
    consoleErrorLog.clear()
  })
}
