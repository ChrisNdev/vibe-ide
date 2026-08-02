import { ipcMain, app } from 'electron'
import path from 'path'
import os from 'os'
import fsSync from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { IPC, AppSettings, RecentProject } from '../../shared/types'
import { store } from '../store'

const execFileAsync = promisify(execFile)

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, async (): Promise<AppSettings> => {
    return store.get('settings')
  })

  ipcMain.handle(IPC.SETTINGS_SET, async (_e, partial: Partial<AppSettings>) => {
    const current = store.get('settings')
    store.set('settings', { ...current, ...partial })
    return store.get('settings')
  })

  ipcMain.handle(IPC.RECENTS_GET, async (): Promise<RecentProject[]> => {
    return store.get('recents')
  })

  ipcMain.handle(IPC.RECENTS_ADD, async (_e, projectPath: string) => {
    const recents = store.get('recents')
    const existing = recents.find((r) => r.path === projectPath)
    const name = path.basename(projectPath)
    const filtered = recents.filter((r) => r.path !== projectPath)
    const entry: RecentProject = {
      path: projectPath,
      name,
      lastOpened: Date.now(),
      pinned: existing?.pinned ?? false
    }
    const next = [entry, ...filtered].slice(0, 20)
    store.set('recents', next)
    return next
  })

  ipcMain.handle(IPC.RECENTS_REMOVE, async (_e, projectPath: string) => {
    const next = store.get('recents').filter((r) => r.path !== projectPath)
    store.set('recents', next)
    return next
  })

  ipcMain.handle(IPC.RECENTS_TOGGLE_PIN, async (_e, projectPath: string) => {
    const next = store.get('recents').map((r) =>
      r.path === projectPath ? { ...r, pinned: !r.pinned } : r
    )
    store.set('recents', next)
    return next
  })

  ipcMain.handle(IPC.CLAUDE_DETECT, async (): Promise<string | null> => {
    const candidates =
      process.platform === 'win32'
        ? ['claude.cmd', 'claude.exe', 'claude']
        : ['claude']

    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || ''
      const npmGlobal = path.join(process.env.APPDATA || '', 'npm', 'claude.cmd')
      const extraPaths = [npmGlobal, path.join(localAppData, 'Programs', 'claude', 'claude.exe')]
      for (const p of extraPaths) {
        if (p && fsSync.existsSync(p)) return p
      }
    }

    for (const cmd of candidates) {
      try {
        const finder = process.platform === 'win32' ? 'where' : 'which'
        const { stdout } = await execFileAsync(finder, [cmd])
        const first = stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean)
        if (first) return first
      } catch {
        // not found, try next candidate
      }
    }
    return null
  })

  ipcMain.handle(IPC.APP_GET_VERSION, async () => {
    return app.getVersion()
  })

  ipcMain.handle(IPC.APP_GET_HOME_DIR, async () => {
    return os.homedir()
  })
}
