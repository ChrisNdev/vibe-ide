import { ipcMain } from 'electron'
import { IPC, HooksInstallResult, HooksStatus } from '../../shared/types'
import { installHooks, uninstallHooks, hooksInstalled } from '../hooks-installer'

export function registerHooksHandlers(): void {
  ipcMain.handle(IPC.HOOKS_INSTALL, async (_e, rootPath: string): Promise<HooksInstallResult> => {
    return installHooks(rootPath)
  })

  ipcMain.handle(IPC.HOOKS_UNINSTALL, async (_e, rootPath: string): Promise<HooksInstallResult> => {
    return uninstallHooks(rootPath)
  })

  ipcMain.handle(IPC.HOOKS_STATUS, async (_e, rootPath: string): Promise<HooksStatus> => {
    return { installed: hooksInstalled(rootPath) }
  })
}
