import { ipcMain, app, shell } from 'electron'
import path from 'path'
import os from 'os'
import fsSync from 'fs'
import fs from 'fs/promises'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { IPC, AppSettings, RecentProject, UpdateCheckResult, UpdateInstallResult, PendingPatchNotes } from '../../shared/types'
import { store, getSettings } from '../store'

const execFileAsync = promisify(execFile)

/** GitHub repo this app publishes releases to — used by the in-app update check. */
const UPDATE_REPO = 'ChrisNdev/vibe-ide'

/** Resolves the gh CLI: PATH first, then the known install spot from this project's own setup script. */
async function resolveGhPath(): Promise<string> {
  try {
    await execFileAsync('gh', ['--version'])
    return 'gh'
  } catch {
    const fallback = path.join(os.homedir(), 'AppData', 'Local', 'gh-cli', 'bin', 'gh.exe')
    if (fsSync.existsSync(fallback)) return fallback
    throw new Error('gh CLI not found')
  }
}

/** Simple dotted-numeric version compare — good enough for this app's x.y.z tags. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, async (): Promise<AppSettings> => {
    return getSettings()
  })

  ipcMain.handle(IPC.SETTINGS_SET, async (_e, partial: Partial<AppSettings>) => {
    const current = getSettings()
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

  ipcMain.handle(IPC.APP_CHECK_UPDATE, async (): Promise<UpdateCheckResult> => {
    const currentVersion = app.getVersion()
    try {
      const gh = await resolveGhPath()
      const { stdout } = await execFileAsync(gh, [
        'release',
        'view',
        '--repo',
        UPDATE_REPO,
        '--json',
        'tagName,url'
      ])
      const data = JSON.parse(stdout) as { tagName: string; url: string }
      const latestVersion = data.tagName.replace(/^v/, '')
      return {
        currentVersion,
        latestVersion,
        latestTag: data.tagName,
        hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
        releaseUrl: data.url,
        error: false
      }
    } catch {
      return { currentVersion, latestVersion: null, latestTag: null, hasUpdate: false, releaseUrl: null, error: true }
    }
  })

  ipcMain.handle(IPC.APP_OPEN_EXTERNAL, async (_e, url: string) => {
    if (/^https:\/\/github\.com\//.test(url)) await shell.openExternal(url)
  })

  ipcMain.handle(IPC.APP_GET_PENDING_PATCH_NOTES, async (): Promise<PendingPatchNotes | null> => {
    const currentVersion = app.getVersion()
    const lastSeen = store.get('lastSeenVersion')
    store.set('lastSeenVersion', currentVersion)
    // null lastSeen = fresh install, nothing to compare against — don't greet a first-time user with "patch notes"
    if (lastSeen === null || lastSeen === currentVersion) return null

    try {
      const gh = await resolveGhPath()
      const { stdout } = await execFileAsync(gh, ['release', 'view', `v${currentVersion}`, '--repo', UPDATE_REPO, '--json', 'body,url'])
      const data = JSON.parse(stdout) as { body: string; url: string }
      return { version: currentVersion, notes: data.body || null, releaseUrl: data.url }
    } catch {
      // gh unavailable/not logged in/no matching release — still worth a one-time "you're now on vX" nudge
      return { version: currentVersion, notes: null, releaseUrl: null }
    }
  })

  ipcMain.handle(IPC.APP_INSTALL_UPDATE, async (_e, releaseTag: string): Promise<UpdateInstallResult> => {
    if (process.platform !== 'win32') {
      return { ok: false, error: 'Atualização automática só é suportada no Windows.' }
    }
    try {
      const gh = await resolveGhPath()
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeide-update-'))
      await execFileAsync(gh, [
        'release',
        'download',
        releaseTag,
        '--repo',
        UPDATE_REPO,
        '--pattern',
        '*.exe',
        '--dir',
        tempDir,
        '--clobber'
      ])
      const files = await fs.readdir(tempDir)
      const installerName = files.find((f) => f.toLowerCase().endsWith('.exe'))
      if (!installerName) throw new Error('Instalador não encontrado nos arquivos da release.')
      const installerPath = path.join(tempDir, installerName)
      const exePath = app.getPath('exe')

      // The installer can't replace this process's own .exe while it's still running (Windows
      // file lock), so a detached helper waits for us to fully quit, installs silently, then
      // relaunches the (now updated) app. Runs independently of our process via detached+unref.
      const script = `timeout /t 2 /nobreak >nul && "${installerPath}" /S && "${exePath}"`
      spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref()

      setTimeout(() => app.quit(), 300)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
