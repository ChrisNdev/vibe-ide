import pty, { IPty } from '@homebridge/node-pty-prebuilt-multiarch'
import { BrowserWindow } from 'electron'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { IPC, PtySpawnOptions } from '../shared/types'

interface Session {
  proc: IPty
  cwd: string
}

const sessions = new Map<string, Session>()

function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

export function spawnPty(win: BrowserWindow, opts: PtySpawnOptions): void {
  killPty(opts.id)

  const shellPath = opts.shell || defaultShell()
  const isPowerShell = /powershell(\.exe)?$/i.test(shellPath) || /pwsh(\.exe)?$/i.test(shellPath)

  const proc = pty.spawn(shellPath, opts.args ?? [], {
    name: 'xterm-256color',
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd,
    env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
    useConpty: process.platform === 'win32'
  })

  sessions.set(opts.id, { proc, cwd: opts.cwd })

  proc.onData((data) => {
    if (!win.isDestroyed()) win.webContents.send(IPC.PTY_DATA, { id: opts.id, data })
  })

  proc.onExit(({ exitCode, signal }) => {
    sessions.delete(opts.id)
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.PTY_EXIT, { id: opts.id, exitCode, signal })
    }
  })

  if (opts.autoRun) {
    const cmd = opts.autoRun.trim()
    const newline = isPowerShell || process.platform !== 'win32' ? '\r' : '\r\n'
    setTimeout(() => {
      proc.write(cmd + newline)
    }, 300)
  }
}

export function writePty(id: string, data: string): void {
  sessions.get(id)?.proc.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  const s = sessions.get(id)
  if (!s) return
  try {
    s.proc.resize(Math.max(cols, 1), Math.max(rows, 1))
  } catch {
    // resize can throw if the pty already exited; ignore
  }
}

export function killPty(id: string): void {
  const s = sessions.get(id)
  if (!s) return
  sessions.delete(id)

  // On Windows, ConPTY only terminates the immediate shell process — it does not
  // tear down descendants (e.g. `claude` spawned from PowerShell). Kill the whole
  // process tree explicitly to avoid orphaned zombie processes after the app quits.
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(s.proc.pid), '/t', '/f'], { stdio: 'ignore' })
    } catch {
      // process tree may already be gone
    }
  }

  try {
    s.proc.kill()
  } catch {
    // already dead
  }
}

export function killAllPtys(): void {
  for (const id of Array.from(sessions.keys())) killPty(id)
}

export function detectShells(): { id: string; name: string; path: string }[] {
  const shells: { id: string; name: string; path: string }[] = []
  if (process.platform === 'win32') {
    const pwsh7 = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
    if (fs.existsSync(pwsh7)) shells.push({ id: 'pwsh7', name: 'PowerShell 7', path: pwsh7 })

    const winPS = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    if (fs.existsSync(winPS)) shells.push({ id: 'powershell', name: 'Windows PowerShell', path: winPS })

    const cmd = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe')
    if (fs.existsSync(cmd)) shells.push({ id: 'cmd', name: 'Command Prompt', path: cmd })

    const gitBashCandidates = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe'
    ]
    for (const gb of gitBashCandidates) {
      if (fs.existsSync(gb)) {
        shells.push({ id: 'gitbash', name: 'Git Bash', path: gb })
        break
      }
    }

    const wsl = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wsl.exe')
    if (fs.existsSync(wsl)) shells.push({ id: 'wsl', name: 'WSL', path: wsl })
  } else {
    shells.push({ id: 'default', name: os.userInfo().shell || '/bin/bash', path: os.userInfo().shell || '/bin/bash' })
  }
  return shells
}
