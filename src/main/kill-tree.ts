import { spawn } from 'child_process'

/**
 * Kills a process and everything it spawned. Needed in two places for the same reason:
 * ConPTY only terminates the immediate shell (leaving `claude` behind), and dev servers
 * (vite/webpack/next) fork children that outlive a plain kill() of the parent.
 *
 * Detached + unref'd rather than execFileSync: this runs on window-all-closed/before-quit,
 * where a synchronous taskkill froze the UI for ~100ms per live terminal before the window
 * would go away. Detaching also means the kill still completes if the app exits first —
 * the same mechanism the updater helper in ipc/settings.ts already relies on.
 */
export function killProcessTree(pid: number | undefined, fallbackKill: () => void): void {
  if (process.platform !== 'win32' || !pid) {
    fallbackKill()
    return
  }
  try {
    spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref()
  } catch {
    // taskkill missing or the tree is already gone — the direct kill below still applies
    fallbackKill()
  }
}
