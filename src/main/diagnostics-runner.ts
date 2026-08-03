import { execFile } from 'child_process'
import { promisify } from 'util'
import fsSync from 'fs'
import path from 'path'
import type { TscIssue, DiagnosticsResult } from '../shared/types'

const execFileAsync = promisify(execFile)

function parseTscOutput(output: string): TscIssue[] {
  const issues: TscIssue[] = []
  const re = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+: .+)$/
  for (const rawLine of output.split(/\r?\n/)) {
    const m = rawLine.match(re)
    if (m) issues.push({ file: m[1], line: Number(m[2]), column: Number(m[3]), message: m[5] })
  }
  return issues
}

async function runTsc(rootPath: string): Promise<{ available: boolean; issues: TscIssue[] }> {
  const tscBin = path.join(rootPath, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
  const hasTsconfig = fsSync.existsSync(path.join(rootPath, 'tsconfig.json'))
  const hasLocalTsc = fsSync.existsSync(tscBin)
  if (!hasTsconfig || !hasLocalTsc) return { available: false, issues: [] }
  try {
    const { stdout } = await execFileAsync(tscBin, ['--noEmit', '--pretty', 'false'], { cwd: rootPath, maxBuffer: 16 * 1024 * 1024 })
    return { available: true, issues: parseTscOutput(stdout) }
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout ?? ''
    return { available: true, issues: parseTscOutput(stdout) }
  }
}

async function runEslint(rootPath: string): Promise<{ available: boolean; issues: unknown[] }> {
  const eslintBin = path.join(rootPath, 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint')
  const hasConfig = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.cjs', 'eslint.config.js', 'eslint.config.mjs'].some((f) =>
    fsSync.existsSync(path.join(rootPath, f))
  )
  if (!hasConfig || !fsSync.existsSync(eslintBin)) return { available: false, issues: [] }
  try {
    const { stdout } = await execFileAsync(eslintBin, ['.', '--format', 'json'], { cwd: rootPath, maxBuffer: 16 * 1024 * 1024 })
    return { available: true, issues: JSON.parse(stdout) }
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout
    try {
      return { available: true, issues: stdout ? JSON.parse(stdout) : [] }
    } catch {
      return { available: true, issues: [] }
    }
  }
}

/** Shared by the Fase 8 diagnostics panel and the Fase 7 MCP get_diagnostics tool — one implementation, two consumers. */
export async function runDiagnostics(rootPath: string): Promise<DiagnosticsResult> {
  const [typescript, eslint] = await Promise.all([runTsc(rootPath), runEslint(rootPath)])
  return { typescript, eslint }
}
