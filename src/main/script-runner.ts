import { spawn, ChildProcessByStdio } from 'child_process'
import type { Readable } from 'stream'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import crypto from 'crypto'
import { PackageScript } from '../shared/types'
import { killProcessTree } from './kill-tree'

type RunProcess = ChildProcessByStdio<null, Readable, Readable>

interface ActiveRun {
  runId: string
  proc: RunProcess
  portReported: boolean
}

const activeRuns = new Map<number, ActiveRun>()

export async function listScripts(rootPath: string): Promise<PackageScript[]> {
  try {
    const raw = await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8')
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
    return Object.entries(pkg.scripts ?? {}).map(([name, command]) => ({ name, command }))
  } catch {
    return []
  }
}

function detectPackageManager(rootPath: string): { bin: string; runArgs: (script: string) => string[] } {
  const isWin = process.platform === 'win32'
  if (fsSync.existsSync(path.join(rootPath, 'pnpm-lock.yaml'))) {
    return { bin: isWin ? 'pnpm.cmd' : 'pnpm', runArgs: (s) => ['run', s] }
  }
  if (fsSync.existsSync(path.join(rootPath, 'yarn.lock'))) {
    return { bin: isWin ? 'yarn.cmd' : 'yarn', runArgs: (s) => ['run', s] }
  }
  return { bin: isWin ? 'npm.cmd' : 'npm', runArgs: (s) => ['run', s] }
}

const PORT_RE = /(?:localhost|127\.0\.0\.1):(\d{2,5})\b/

export function stopScript(windowId: number): void {
  const run = activeRuns.get(windowId)
  if (!run) return
  activeRuns.delete(windowId)
  // Dev-server processes (vite, webpack, next) commonly spawn children that survive
  // a plain kill() of the parent — same reasoning as pty-manager.ts's terminal cleanup.
  killProcessTree(run.proc.pid, () => run.proc.kill())
}

export function runScript(
  windowId: number,
  rootPath: string,
  scriptName: string,
  onOutput: (runId: string, text: string, stream: 'stdout' | 'stderr') => void,
  onStatus: (runId: string, event: { type: 'exit' | 'server-detected'; exitCode?: number | null; port?: number }) => void
): string {
  stopScript(windowId)

  const runId = crypto.randomBytes(6).toString('hex')
  const { bin, runArgs } = detectPackageManager(rootPath)
  const proc = spawn(bin, runArgs(scriptName), { cwd: rootPath, stdio: ['ignore', 'pipe', 'pipe'] })
  const run: ActiveRun = { runId, proc, portReported: false }
  activeRuns.set(windowId, run)

  const handleChunk = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
    const chunkText = chunk.toString('utf-8')
    onOutput(runId, chunkText, stream)
    if (!run.portReported) {
      const match = chunkText.match(PORT_RE)
      if (match) {
        run.portReported = true
        onStatus(runId, { type: 'server-detected', port: Number(match[1]) })
      }
    }
  }

  proc.stdout.on('data', handleChunk('stdout'))
  proc.stderr.on('data', handleChunk('stderr'))
  // Required, not optional: a ChildProcess that emits 'error' with no listener throws an
  // uncaught exception and takes the whole main process down. That fires whenever the package
  // manager isn't on PATH (npm.cmd/pnpm.cmd/yarn.cmd missing) — i.e. clicking "rodar" on a
  // machine without Node on PATH used to kill the app instead of printing an error.
  proc.on('error', (err) => {
    onOutput(runId, `Não consegui executar "${bin}": ${err.message}\n`, 'stderr')
  })
  proc.on('close', (exitCode) => {
    if (activeRuns.get(windowId)?.runId === runId) activeRuns.delete(windowId)
    onStatus(runId, { type: 'exit', exitCode })
  })

  return runId
}
